const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    firstName: {
        type: String,
    }, 
    lastName: {
        type: String,
    },
    email: {
        type: String,
    },
    password: {
        type: String,
    },
    isVerified: {
        type: Boolean,
        default: false,
    },
    stack: {
        type: String, 
    },
    role: {
        type: String,
        default: "student",
    },
    cohort: {
        type: Number, 
    },
    allRatings: {
        type: Array,
    }, 
    overallRating: {
        type: Number,
    }, 
    weeklyRating: {
        type: Number,
    },
    nominted: {
        type: Boolean,
        default: false,
    }, 
    studentOfTheWeek: {
        type: Boolean,
        default: false,
    }, 
    bStudentOfTheWeek: {
        type: Boolean,
        default: false,
    }, 
    pStudentOfTheWeek: {
        type: Boolean,
        default: false,
    }, 
    token: {
        type: String,
    }, 
}, {timestamps: true});

const userModel = mongoose.model('User', userSchema);

module.exports = userModel;