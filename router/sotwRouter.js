const express = require('express');

const router = express.Router();

const { createRating, getRating, getAllRating, updateRating, deleteRating, SOTW, viewSOTW, viewAllSOTW, deleteSOTWb, deleteSOTWf, deleteSOTWp } = require('../controllers/weeklyRatingsController');
const { authenticate, } = require("../middleware/authentation");

//endpoint to add rate a student by week
router.post('/addRating/:userId', createRating);

//endpoint to get a student rating
router.get('/studentRating/:ratingId', getRating);

//endpoint to get all students ratings
router.get('/getAllStudentRatings', getAllRating);

//endpoint to update a student rating
router.put('/updateRating/:userId/:ratingId', updateRating);

//endpoint to delete a student rating
router.delete('/deleteRating/:ratingId', deleteRating);

//endpoint to get the student of the week
router.get('/getSOTW', SOTW); 

//view SOTW by for a particular week and stacks
router.get('/viewSOTW', viewSOTW);

//view all SOTW for all stacks
router.get('/viewAllSOTW', viewAllSOTW);

//endpoint to delete SOTW for backend 
router.delete('/deleteSOTWb/:sotwId', deleteSOTWb)

//endpoint to delete SOTW for frontend 
router.delete('/deleteSOTWf/:sotwId', deleteSOTWf)

//endpoint to delete SOTW for product design 
router.delete('/deleteSOTWp/:sotwId', deleteSOTWp)




module.exports = router;