const mongoose = require('mongoose');

const productSOTMSchema = new mongoose.Schema({
    student: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    month: {
        type: String,
    },
    score: {
        type: Number,
    }
}, { timestamps: true });

const productSOTMModel = mongoose.model('productSOTM', productSOTMSchema);

module.exports = productSOTMModel;