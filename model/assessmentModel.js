const mongoose = require('mongoose');

const assessmentSchema = new mongoose.Schema({
    userId: {
        type: String,
    },
    weekStart: {
        type: String,
    },
    weekEnd: {
        type: String,
    },
    averagePunctualityScore: {
        type: Number,
    },
}, { timestamps: true });

const assessmentModel = mongoose.model('Assessment', assessmentSchema);

module.exports = assessmentModel;