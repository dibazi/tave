// Import required modules
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const flash = require('express-flash');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const qrcode = require('qrcode');
const moment = require('moment');
const dotenv = require('dotenv');
let result = dotenv.config();


const app = express();

app.use(express.urlencoded({ extended: true }));
// Create a new Express app
app.use(bodyParser.json());

const dbHost = process.env.DB_HOST;
const dbUser = process.env.DB_USERNAME;
const dbPassword = process.env.DB_PASSWORD;
const dbName = process.env.DB_DATABASE;

// Set up session middleware
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

//acces css file
app.use(express.static(__dirname = "public"));

// Set the view engine to EJS
app.set('view engine', 'ejs');

//app.post('/check_in', (req, res) => {
  // Process the check-in request and display an alert message
 // res.send("<script>alert('You are checked in');</script>");
//});


// Set up body-parser middleware
app.use(bodyParser.urlencoded({ extended: true }));

// Set up MySQL connection pool
const pool = mysql.createPool({
  host: dbHost,
  user: dbUser,
  password: dbPassword,
  database: dbName,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Middleware to check for a session
app.use((req, res, next) => {
  if (req.session.user || req.path === '/login' || req.path === '/register') {
    next();
  } else {
    res.redirect('/login');
  }
});

// Middleware to check for a session and pass user data to the views
app.use((req, res, next) => {
  res.locals.user = req.session.user; // Pass the user data to the views
  next();
});

  // create chauffeur form
  app.get('/index', (req, res) => {
    res.render('index.ejs');
  });

// Render the registration form
app.get('/register', (req, res) => {
    res.render('register.ejs');
});

// Define a middleware to set the current page in the request object
app.use((req, res, next) => {
  res.locals.currentPage = req.url;
  next();
});

// Process the registration form
app.post('/register', (req, res) => {
    const { user_name, email,password, cellphone, birthdate, gender } = req.body;

    // Hash the password
    bcrypt.hash(password, 10, (err, hash) => {
        if (err) {
            console.log(err);
            res.redirect('/register');
            return;
        }

        // Insert the user into the database
        pool.query('INSERT INTO tave_users (user_name, email, password, cellphone, birthdate, gender) VALUES (?, ?, ?, ?, ?, ?)', [user_name, email,hash, cellphone, birthdate, gender], (err, result) => {
            if (err) {
                console.log(err);
                res.redirect('/register');
                return;
            }

            res.redirect('/login');
        });
    });
});

//login route
app.get('/login', (req, res) => {
  res.render('login.ejs');
});

//login route
app.get('/', (req, res) => {
  res.render('createTransaction.ejs');
});

//login function
app.post('/login', (req, res) => {
  const { user_name, password } = req.body;

  pool.query('SELECT * FROM tave_users WHERE user_name = ?', [user_name], async (error, results) => {
    if (error) {
      console.log(error);
      res.redirect('/login');
      return;
    }

    if (results.length === 0) {
      req.flash('error', 'Incorrect username');
      res.redirect('/login');
      return;
    }

    const user = results[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      req.flash('error', 'Incorrect password');
      res.redirect('/login');
      return;
    }

    req.session.user = user;
    res.redirect('/trips');
  });
});

  // create chauffeur form
app.get('/addChauffeur', (req, res) => {
    res.render('createChaffeur.ejs', { title: 'addChauffeur' });
  });

  // Handle the form submission
app.post('/createChauffeur', (req, res) => {
    const { name, surname, middle_name, email, address, cellphone, car_registration, picture, driver_license, car_maker, car_model, car_color } = req.body;
    
    // Insert the form data into the "chauffeur" table
    pool.query('INSERT INTO tave_chauffeurs (name, surname, middle_name, email, address, cellphone, car_registration, picture, driver_license, car_maker, car_model, car_color) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [name, surname, middle_name, email, address, cellphone, car_registration, picture, driver_license, car_maker, car_model, car_color], (err, results) => {
      if (err) {
        console.error('Error inserting data:', err);
        res.send('Error inserting data');
      } else {
        res.redirect('/trips');
      }
    });
  });

// Handle the form submission
app.post('/createTrip', (req, res) => {
    const { user_id, autocomplete_search } = req.body;
  
    const currentDate = new Date();
    const johannesburgOffset = 2; // Johannesburg is UTC+2
    const johannesburgTime = new Date(currentDate.getTime() + johannesburgOffset * 60 * 60 * 1000);
    const year = johannesburgTime.getFullYear();
    const month = String(johannesburgTime.getMonth() + 1).padStart(2, '0');
    const day = String(johannesburgTime.getDate()).padStart(2, '0');
    const hours = String(johannesburgTime.getHours()).padStart(2, '0');
    const minutes = String(johannesburgTime.getMinutes()).padStart(2, '0');
    const seconds = String(johannesburgTime.getSeconds()).padStart(2, '0');
  
    const date = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    const num_plate = autocomplete_search;
  
    // Retrieve chauffeur_id from chauffeurs table based on num_plate
    const selectChauffeurIdQuery = 'SELECT id FROM tave_chauffeurs WHERE car_registration = ?';
    pool.query(selectChauffeurIdQuery, [num_plate], (err, results) => {
      if (err) {
        console.error('Error retrieving chauffeur_id:', err);
        res.send('Error retrieving tave_chauffeurs');
      } else {
        const chauffeur_id = results[0] ? results[0].id : null;
  
        // Insert the form data into the trips table
        const insertTripQuery = 'INSERT INTO tave_trips (user_id, chauffeur_id, num_plate, date) VALUES (?, ?, ?, ?)';
        const values = [user_id, chauffeur_id, num_plate, date];
  
        pool.query(insertTripQuery, values, (err, results) => {
          if (err) {
            console.error('Error inserting data:', err);
            res.send('Error inserting data');
          } else {
            res.redirect('/trips');
          }
        });
      }
    });
  });

  // Fetch trips corresponding to user_id from the database and show the latest trip first
  app.get('/chauffeurs', (req, res) => {
    const sql = 'SELECT * FROM tave_chauffeurs';
  
    pool.query(sql, (err, results) => {
      if (err) {
        console.error('Error fetching chauffeurs:', err);
        res.send('Error fetching chauffeurs');
      } else {
        const chauffeurs = results; // Renamed 'trips' to 'chauffeurs' to match the view variable
        res.render('showChauffers', { title: 'Chauffeurs', chauffeurs }); // Render the EJS template with the chauffeurs data
      }
    });
  });

  // Route to handle the request for a specific chauffeur by ID
app.get('/chauffeur/:id', (req, res) => {
  const chauffeurId = req.params.id;

  const sql = 'SELECT * FROM tave_chauffeurs WHERE id = ?';

  pool.query(sql, [chauffeurId], (err, results) => {
    if (err) {
      console.error('Error fetching chauffeur:', err);
      res.send('Error fetching chauffeur');
    } else {
      if (results.length > 0) {
        const chauffeur = results[0];
        res.render('chauffeur', { chauffeur }); // Render the EJS template with the chauffeur data
      } else {
        res.send('Chauffeur not found');
      }
    }
  });
});

  // Route to handle the request for a specific chauffeur by ID
  app.get('/edit/chauffeur/:id', (req, res) => {
    const chauffeurId = req.params.id;
  
    const sql = 'SELECT * FROM tave_chauffeurs WHERE id = ?';
  
    pool.query(sql, [chauffeurId], (err, results) => {
      if (err) {
        console.error('Error fetching chauffeur:', err);
        res.send('Error fetching chauffeur');
      } else {
        if (results.length > 0) {
          const chauffeur = results[0];
          res.render('updateChauffeur', { chauffeur }); // Render the EJS template with the chauffeur data
        } else {
          res.send('Chauffeur not found');
        }
      }
    });
  });


// Route to handle the update of a specific chauffeur by ID (POST request)
app.post('/edit/chauffeur/:id', (req, res) => {
  const chauffeurId = req.params.id;
  const updatedChauffeurData = req.body; // Assuming the updated data is sent in the request body

  const sql = 'UPDATE tave_chauffeurs SET ? WHERE id = ?';

  pool.query(sql, [updatedChauffeurData, chauffeurId], (err, results) => {
    if (err) {
      console.error('Error updating chauffeur:', err);
      res.send('Error updating chauffeur');
    } else {
      res.redirect(`/chauffeur/${chauffeurId}`);
    }
  });
});

// Fetch trips corresponding to user_id from the database and show the latest trip first
app.get('/trips', (req, res) => {
  const user_id = req.session.user.id; // Assuming you have the user_id available in the request object or session

  const sql = `
    SELECT t.*, c.name AS chauffeur_name
    FROM tave_trips t
    JOIN tave_chauffeurs c ON t.chauffeur_id = c.id
    WHERE t.user_id = ?
    ORDER BY t.date DESC
  `;

  pool.query(sql, [user_id], (err, results) => {
    if (err) {
      console.error('Error fetching trips:', err);
      res.send('Error fetching trips');
    } else {
      const trips = results;
      res.render('showTrips', { title: 'trips', trips }); // Render the EJS template with the trips data
    }
  });
});

  // Fetch chauffeurs data from the database
app.get('/addTrip', (req, res) => {
    pool.query('SELECT name FROM tave_chauffeurs', (err, results) => {
      if (err) {
        console.error('Error fetching chauffeurs:', err);
        res.send('Error fetching chauffeurs');
      } else {
        const chauffeurs = results.map(row => row.name);
        res.render('createTrip', { title: 'addTrip', chauffeurs }); // Render the EJS template
      }
    });
  });

  app.get('/get_data', function(request, response, next){

    var search_query = request.query.search_query;

    var query = `
    SELECT car_registration FROM tave_chauffeurs 
    WHERE car_registration LIKE '%${search_query}%' 
    LIMIT 10
    `;

    pool.query(query, function(error, data){

        response.json(data);

    });

});


// Logout route
app.get('/logout', (req, res) => {
  // Destroy the session and logout the user
  req.session.destroy(err => {
    if (err) {
      console.log(err);
      res.redirect('/');
      return;
    }

    // Redirect the user to the desired page after successful logout
    res.redirect('/login');
  });
});

// Start the server
app.listen(3000, () => {
    console.log('Server started on port 3000');
});
