const mongoose = require('mongoose');

const productSOTWSchema = new mongoose.Schema({
    student: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    week: {
        type: Number,
    },
    score: {
        type: Number,
    }
}, { timestamps: true });

const productSOTWModel = mongoose.model('productSOTW', productSOTWSchema);

module.exports = productSOTWModel;