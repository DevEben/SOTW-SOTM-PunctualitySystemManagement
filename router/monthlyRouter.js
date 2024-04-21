const express = require('express');

const router = express.Router();

const { monthlyRating, monthlyRatingAuto, viewMonthlyRating, viewAllMonthlyRating, SOTM, viewSOTM, viewAllSOTM, deleteSOTMb, deleteSOTMf, deleteSOTMp, } = require('../controllers/monthlyRatingController');
const { authenticate, } = require("../middleware/authentation");


//endpoint to generate a student monthly rating
router.get('/monthlyRating/:userId', monthlyRating);

//endpoint to generate all students monthly rating once
router.get('/monthlyRating', monthlyRatingAuto);

//endpoint to view a monthly rating
router.get('/viewMonthlyRating', viewMonthlyRating)

//endpoint to view all monthly ratings
router.get('/viewAllMonthlyRating', viewAllMonthlyRating)

//endpoint to get the student of the month for the each stacks
router.get('/getSOTM', SOTM); 

//view SOTM by for a particular month and stacks
router.get('/viewSOTM', viewSOTM);

//view all SOTM for all stacks
router.get('/viewAllSOTM', viewAllSOTM);

//endpoint to delete SOTM for backend 
router.delete('/deleteSOTMb/:sotmId', deleteSOTMb)

//endpoint to delete SOTM for frontend 
router.delete('/deleteSOTMf/:sotmId', deleteSOTMf)

//endpoint to delete SOTM for product design 
router.delete('/deleteSOTMp/:sotmId', deleteSOTMp)


module.exports = router;