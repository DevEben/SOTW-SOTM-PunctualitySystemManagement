const express = require('express');

const router = express.Router();

const { signUp, verify, logIn, forgotPassword, resetPasswordPage, resetPassword, signOut, } = require('../controllers/userController');
const { checkIn, assessmentData, assessmentDataS, fetchCheckInWeekly, fetchAllCheckInWeekly, fetchAssessmentData, fetchOneAssessmentData, deleteCheckIn, deleteWeekCheckIn, deleteAssessment,  } = require('../controllers/punctualityController');
const { authenticate, } = require("../middleware/authentation");

//endpoint to register a new user
router.post('/signup', signUp);

//endpoint to verify a registered user
router.get('/verify/:id/:token', verify);

//endpoint to login a verified user
router.post('/login', logIn);

//endpoint for forget Password
router.post('/forgot', forgotPassword);

//endpoint for reset Password Page
router.get('/reset/:userId', resetPasswordPage);

//endpoint to reset user Password
router.post('/reset-user/:userId', resetPassword);

//endpoint to sign out a user
router.post("/signout", authenticate, signOut);




//endpoint to add user location and image
router.post("/checkIn", authenticate, checkIn);

//endpoint to get a student Data and calculate the average punctuality for the current week
router.get('/assessment/:userId', authenticate, assessmentData);

//endpoint to get all students Data and calculate their average punctuality for the current week
router.get('/assessmentAll', authenticate, assessmentDataS);

//endpoint to get a student attendance data
router.get("/studentAttendance/:userId", authenticate, fetchCheckInWeekly);

//endpoint to get all students attendance data
router.get("/groupStudentAttendance", authenticate, fetchAllCheckInWeekly);

//endpoint to get all student assessment data for a particular week
router.get("/fetchAssessment", authenticate, fetchAssessmentData);

//endpoint to get a student assessment data for a particular week
router.get("/fetchOneAssessment/:userId", authenticate, fetchOneAssessmentData);

//endpoint to delete a student checkIn data
router.delete("/deleteCheckIn/:checkInID", authenticate, deleteCheckIn);

//endpoint to delete a student checkIn data for the full week
router.delete("/deleteCheckInfullWeek/:userId", authenticate, deleteWeekCheckIn);

//endpoint to delete assessment for a particular student
router.delete("/deleteAssessment/:assessmentId", authenticate, deleteAssessment);



module.exports = router;