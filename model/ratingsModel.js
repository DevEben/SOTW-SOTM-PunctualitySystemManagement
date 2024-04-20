const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
    punctuality: {
        type: Number,
    }, 
    Assignment: {
        type: Number,
    },
    personalDefense: {
        type: Number,
    }, 
    classParticipation: {
        type: Number,
    }, 
    classAssessment: {
        type: Number,
    },
    total: {
        type: Number,
    },
    student: [{
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User"
    }], 
    week: {
        type: Number,
    }
}, {timestamps: true});

const ratingModel = mongoose.model('Ratings', ratingSchema);

module.exports = ratingModel;