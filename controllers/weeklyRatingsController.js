const userModel = require("../model/userModel");
const ratingsModel = require("../model/ratingsModel");
const backendSOTWModel = require('../model/backendSOTW');
const frontendSOTWModel = require('../model/frontendSOTW');
const productSOTWModel = require('../model/productSOTW');
const { validateRatings, validateRatingsUpdate, } = require("../middleware/validator");
const _ = require('lodash');
require('dotenv').config();


//Function to create a new rating for a student
const createRating = async (req, res) => {
    try {
        const { error } = validateRatings(req.body);
        if (error) {
            return res.status(500).json({
                message: error.details[0].message
            });
        } else {
            const today = new Date();
            const userId = req.params.userId;

            //check the student in the database
            const student = await userModel.findById(userId);
            if (!student) {
                return res.status(404).json({
                    message: 'Student not found',
                });
            }

            const { punctuality, Assignment, personalDefense, classParticipation, classAssessment, week } = req.body;

            const checkRatingForWeek = await ratingsModel.find({week: week});
            if (checkRatingForWeek) {
                return res.status(400).json({
                    message: `Sorry rating for week ${week} for ${student.firstName} ${student.lastName} has already been added`,
                })
            }


            // Calculate total score
            const totalScore = Object.values({ punctuality, Assignment, personalDefense, classParticipation, classAssessment }).reduce((total, score) => total + score, 0);

            // Create rating document
            const rating = await ratingsModel.create({
                punctuality: punctuality,
                Assignment: Assignment,
                personalDefense: personalDefense,
                classParticipation: classParticipation,
                classAssessment: classAssessment,
                total: totalScore,
                week: week,
            });

            //Add the totalScore to the allRating array
            const studentAllRatings = student.allRatings.push(rating.total);
            if (studentAllRatings.length <= 0) {
                return res.status(400).json({
                    message: "Sorry student don't have any ratings yet!"
                })
            }

            //Sum all totalScores for the student and get the percentage score
            const sum = student.allRatings.reduce((acc, score) => acc + score, 0);

            // Calculate the average
            const average = sum / student.allRatings.length;

            //Calculate student overallRating percentage score
            student.overallRating = average;

            // Add the student to the rating
            rating.student.push(student);

            // Save the rating document
            await rating.save();

            // Save the student document
            await student.save();

            return res.status(200).json({
                message: "Student rating created successfully",
                rating: rating,
            });
        }
    } catch (error) {
        return res.status(500).json({
            message: "Internal Server Error: " + error.message,
        });
    }
};


// Function to view a particular student rating score
const getRating = async (req, res) => {
    try {
        const ratingId = req.params.ratingId;
        const rating = await ratingsModel.findById(ratingId);
        if (!rating) {
            return res.status(404).json({
                message: "No rating found for the student!"
            })
        }

        return res.status(200).json({
            message: "Rating fetched successfully",
            rating: rating,
        });

    } catch (error) {
        return res.status(500).json({
            message: "Internal Server Error: " + error.message,
        });
    }
}


// Function to view all students rating score
const getAllRating = async (req, res) => {
    try {
        const ratings = await ratingsModel.find();
        if (!ratings) {
            return res.status(404).json({
                message: "No ratings found!"
            })
        }

        // Group rating data by student using lodash's groupBy function
        const groupedRating = _.groupBy(ratings, 'student');

        return res.status(200).json({
            message: "Rating fetched successfully",
            rating: groupedRating,
        });

    } catch (error) {
        return res.status(500).json({
            message: "Internal Server Error: " + error.message,
        });
    }
}



// Function to update a particular student rating
const updateRating = async (req, res) => {
    try {
        const { error } = validateRatingsUpdate(req.body);
        if (error) {
            return res.status(500).json({
                message: error.details[0].message
            });
        } else {
            const userId = req.params.userId;
            const student = await userModel.findById(userId);
            if (!student) {
                return res.status(404).json({
                    message: 'Student not found',
                });
            }

            const ratingId = req.params.ratingId;
            const rating = await ratingsModel.findById(ratingId);
            if (!rating) {
                return res.status(404).json({
                    message: "No rating found!"
                });
            }

            const ratingData = {
                punctuality: req.body.punctuality || rating.punctuality,
                Assignment: req.body.Assignment || rating.Assignment,
                personalDefense: req.body.personalDefense || rating.personalDefense,
                classParticipation: req.body.classParticipation || rating.classParticipation,
                classAssessment: req.body.classAssessment || rating.classAssessment,
                week: req.body.week || rating.week,
                student: rating.student,
            }

            // Calculate total score
            const totalScore = Object.values({ punctuality: ratingData.punctuality, Assignment: ratingData.Assignment, personalDefense: ratingData.personalDefense, classParticipation: ratingData.classParticipation, classAssessment: ratingData.classAssessment }).reduce((total, score) => total + score, 0);
            ratingData.total = Math.round(totalScore);

            // Update the allRatings array
            const indexOfValueToUpdate = student.allRatings.indexOf(rating.total);
            if (indexOfValueToUpdate !== -1) {
                student.allRatings[indexOfValueToUpdate] = totalScore;
                // Check if the updated allRatings array is empty
                if (student.allRatings.length <= 0) {
                    return res.status(400).json({
                        message: "Sorry student doesn't have any ratings yet!"
                    });
                }
            }

            // Recalculate overallRating
            const sum = student.allRatings.reduce((acc, score) => acc + score, 0);
            const average = sum / student.allRatings.length;
            student.overallRating = average * 100;

            // Save the student document
            await student.save();

            // Update the rating document
            const updatedRating = await ratingsModel.findByIdAndUpdate(ratingId, ratingData, { new: true });
            if (!updatedRating) {
                return res.status(400).json({
                    message: "Unable to update the rating!"
                });
            }

            return res.status(200).json({
                message: "Rating updated successfully",
                rating: updatedRating
            });
        }
    } catch (error) {
        return res.status(500).json({
            message: "Internal Server Error: " + error.message,
        });
    }
}




// Function to delete a particular rating
const deleteRating = async (req, res) => {
    try {
        const ratingId = req.params.ratingId;
        const rating = await ratingsModel.findById(ratingId);
        if (!rating) {
            return res.status(404).json({
                message: "No rating found!"
            });
        }

        const deletedRating = await ratingsModel.findByIdAndDelete(ratingId);
        if (!deletedRating) {
            return res.status(400).json({
                message: "Unable to delete rating!"
            })
        }

        return res.status(200).json({
            message: "Rating updated successfully",
            rating: deletedRating
        })

    } catch (error) {
        return res.status(500).json({
            message: "Internal Server Error: " + error.message,
        });
    }
}



// Function to get the SOTW 
// const SOTW = async (req, res) => {
//     try {
//         const week = req.body.week;
//         const fetchStudentByWeek = await ratingsModel.find({ week }).populate("student");
//         if (!fetchStudentByWeek) {
//             return res.status(404).json({
//                 message: "Students not found",
//             })
//         }

//         //To get the SOTW for Backend
//         const filterByStack = fetchStudentByWeek.filter((rating) => (rating.student[0].stack === "backend") && (rating.student[0].role === "student"));
//         if (filterByStack.length === 0) {
//             return res.status(400).json({
//                 message: "No student found!"
//             })
//         }
//         const getEachScore = filterByStack.map((StudentScore) => ({
//             week: StudentScore.week,
//             total: StudentScore.total,
//             student: StudentScore.student[0]
//         }))

//         // Extracting an array of total scores
//         const scores = getEachScore.map(score => score.total);

//         // Finding the maximum score
//         const maxScore = Math.max(...scores);

//         // Filtering for students with the maximum score
//         const highScores = getEachScore.filter(score => score.total === maxScore);
//         let selectedStudent;

//         // If there are multiple students with the same maximum score
//         if (highScores.length > 1) {
//             //let lowestPrevWeekScoreStudent = highScores[0].student; // Initialize with the first student
//             let lowestPrevWeekScore = []; // Initialize with an empty array
//             for (const score of highScores) {
//                 const prevWeekScore = await ratingsModel.findOne({ week: score.week - 1, student: score.student._id });
//                 const totalScore = prevWeekScore ? prevWeekScore.total : 0; // Use default value if prevWeekScore is not found
//                 lowestPrevWeekScore.push(totalScore); // Push totalScore into the array
//             }
//             // Find the minimum score from the array
//             const minPrevWeekScore = Math.min(...lowestPrevWeekScore);
//             // Find the index of the minimum score in the array
//             const minScoreIndex = lowestPrevWeekScore.indexOf(minPrevWeekScore);
//             // Get the corresponding student with the lowest score
//             selectedStudent = highScores[minScoreIndex].student;
//         } else {
//             selectedStudent = highScores[0].student;
//         }

//         //check if the backendSOTW has been selected before
//         const checkBackendSOTW = await backendSOTWModel.findOne({ week: week });
//         if (checkBackendSOTW) {
//             return res.status(400).json({
//                 message: "Backend SOTW has already been selected for this week!"
//             })
//         }

//         //Saving the selected student to the backendSOTW document 
//         const selectedBackendSOTW = await backendSOTWModel.create({
//             student: selectedStudent,
//             week: week,
//             score: maxScore
//         })


//         //To get the SOTW for Frontend
//         const filterByStackF = fetchStudentByWeek.filter((rating) => (rating.student[0].stack === "frontend") && (rating.student[0].role === "student"));
//         if (filterByStack.length === 0) {
//             return res.status(400).json({
//                 message: "No student found!"
//             })
//         }
//         const getEachScoreF = filterByStackF.map((StudentScore) => ({
//             week: StudentScore.week,
//             total: StudentScore.total,
//             student: StudentScore.student[0]
//         }))

//         // Extracting an array of total scores
//         const scoresF = getEachScoreF.map(score => score.total);

//         // Finding the maximum score
//         const maxScoreF = Math.max(...scoresF);

//         // Filtering for students with the maximum score
//         const highScoresF = getEachScoreF.filter(score => score.total === maxScoreF);
//         let selectedStudentF;

//         // If there are multiple students with the same maximum score
//         if (highScoresF.length > 1) {
//             //let lowestPrevWeekScoreStudent = highScoresF[0].student; // Initialize with the first student
//             let lowestPrevWeekScore = []; // Initialize with an empty array
//             for (const score of highScoresF) {
//                 const prevWeekScore = await ratingsModel.findOne({ week: score.week - 1, student: score.student._id });
//                 const totalScore = prevWeekScore ? prevWeekScore.total : 0; // Use default value if prevWeekScore is not found
//                 lowestPrevWeekScore.push(totalScore); // Push totalScore into the array
//             }
//             // Find the minimum score from the array
//             const minPrevWeekScore = Math.min(...lowestPrevWeekScore);
//             // Find the index of the minimum score in the array
//             const minScoreIndex = lowestPrevWeekScore.indexOf(minPrevWeekScore);
//             // Get the corresponding student with the lowest score
//             selectedStudentF = highScoresF[minScoreIndex].student;
//         } else {
//             selectedStudentF = highScoresF[0].student;
//         }

//         //check if the frontendSOTW has been selected before
//         const checkFrontendSOTW = await frontendSOTWModel.findOne({ week: week });
//         if (checkFrontendSOTW) {
//             return res.status(400).json({
//                 message: "Frontend SOTW has already been selected for this week!"
//             })
//         }

//         //Saving the selected student to the frontendSOTW document 
//         const selectedFrontendSOTW = await frontendSOTWModel.create({
//             student: selectedStudentF,
//             week: week,
//             score: maxScoreF
//         })


//         //To get the SOTW for Product Design
//         const filterByStackP = fetchStudentByWeek.filter((rating) => (rating.student[0].stack === "productDesign") && (rating.student[0].role === "student"));
//         if (filterByStackP.length === 0) {
//             return res.status(400).json({
//                 message: "No student found!"
//             })
//         }
//         const getEachScoreP = filterByStackP.map((StudentScore) => ({
//             week: StudentScore.week,
//             total: StudentScore.total,
//             student: StudentScore.student[0]
//         }))

//         // Extracting an array of total scores
//         const scoresP = getEachScoreP.map(score => score.total);

//         // Finding the maximum score
//         const maxScoreP = Math.max(...scoresP);

//         // Filtering for students with the maximum score
//         const highScoresP = getEachScoreP.filter(score => score.total === maxScoreP);
//         let selectedStudentP;

//         // If there are multiple students with the same maximum score
//         if (highScoresP.length > 1) {
//             //let lowestPrevWeekScoreStudent = highScoresP[0].student; // Initialize with the first student
//             let lowestPrevWeekScore = []; // Initialize with an empty array
//             for (const score of highScoresP) {
//                 const prevWeekScore = await ratingsModel.findOne({ week: score.week - 1, student: score.student._id });
//                 const totalScore = prevWeekScore ? prevWeekScore.total : 0; // Use default value if prevWeekScore is not found
//                 lowestPrevWeekScore.push(totalScore); // Push totalScore into the array
//             }
//             // Find the minimum score from the array
//             const minPrevWeekScore = Math.min(...lowestPrevWeekScore);
//             // Find the index of the minimum score in the array
//             const minScoreIndex = lowestPrevWeekScore.indexOf(minPrevWeekScore);
//             // Get the corresponding student with the lowest score
//             selectedStudentP = highScoresP[minScoreIndex].student;
//         } else {
//             selectedStudentP = highScoresP[0].student;
//         }

//         //check if the productSOTW has been selected before
//         const checkProductSOTW = await productSOTWModel.findOne({ week: week });
//         if (checkProductSOTW) {
//             return res.status(400).json({
//                 message: "Product design SOTW has already been selected for this week!"
//             })
//         }

//         //Saving the selected student to the productSOTW document 
//         const selectedProductSOTW = await productSOTWModel.create({
//             student: selectedStudentP,
//             week: week,
//             score: maxScoreP
//         })



//         return res.status(200).json({
//             message: "Student of the successfully selected for the following stacks:",
//             FrontEnd: selectedStudentF,
//             BackEnd: selectedStudent, 
//             ProductDesign: selectedStudentP,
//         });


//     } catch (error) {
//         return res.status(500).json({
//             message: "Internal Server Error: " + error.message,
//         });
//     }
// }



// Function to select Student of the Week (SOTW) for a specific stack and week
const selectSOTWForStack = async (stack, week, ratingsModel, sotwModel) => {
    // Fetch students' ratings for the specified stack and week
    const allRatings = await ratingsModel.find({ week }).populate('student');

    // Filter ratings by stack and role
    const filterByStack = allRatings.filter(rating => {
        // Check if the student's stack and role match the provided parameters
        const student = rating.student; // Assuming student is an array of objects
        const matchingStudent = student.find(s => s.stack === stack && s.role === 'student');
        return matchingStudent !== undefined; // Return true if the student matches the criteria
    });

    // If no students found for the stack, throw an error
    if (filterByStack.length === 0) {
        throw new Error(`No student found for ${stack} stack in week ${week}!`);
    }

    // Map each student's score and information
    const getEachScore = filterByStack.map(score => ({
        week: score.week,
        total: score.total,
        student: score.student[0]
    }));

    // Extract the scores
    const scores = getEachScore.map(score => score.total);
    // Find the maximum score
    const maxScore = Math.max(...scores);
    // Filter students with the maximum score
    const highScores = getEachScore.filter(score => score.total === maxScore);

    // If there's only one student with the maximum score, return the student and score
    if (highScores.length === 1) {
        return { student: highScores[0].student, score: maxScore };
    } else { // If multiple students have the same maximum score, consider previous week's score
        let lowestPrevWeekScore = [];
        for (const score of highScores) {
            // Find the previous week's score for each student
            const prevWeekScore = await ratingsModel.findOne({ week: score.week - 1, student: score.student._id });
            // Use the previous week's score or default to 0 if not found
            const totalScore = prevWeekScore ? prevWeekScore.total : 0;
            lowestPrevWeekScore.push(totalScore);
        }
        // Find the minimum previous week's score among the high scorers
        const minPrevWeekScore = Math.min(...lowestPrevWeekScore);
        const minScoreIndex = lowestPrevWeekScore.indexOf(minPrevWeekScore);
        // Return the student with the lowest previous week's score
        return { student: highScores[minScoreIndex].student, score: maxScore };
    }
};

// Function to select SOTW for a given stack and handle error checking
const selectSOTW = async (stack, week, ratingsModel, sotwModel) => {
    // Select SOTW for the specified stack and week
    const selectedSOTW = await selectSOTWForStack(stack, week, ratingsModel, sotwModel);
    console.log(selectedSOTW)
    const { student, score } = selectedSOTW;

    // Check if SOTW has already been selected for the given week
    const checkSOTW = await sotwModel.findOne({ week });
    
    // If SOTW already exists for the week, throw an error
    if (checkSOTW) {
        throw new Error(`${stack} SOTW has already been selected for week ${week}!`);
    }
    
    // Create SOTW entry in the database
    await sotwModel.create({ student, week, score });
    // Return the selected student
    return student;
};

// Main function to select SOTW for all stacks
const SOTW = async (req, res) => {
    try {
        const week = req.body.week;
        // Select SOTW for Backend stack
        const selectedBackendSOTW = await selectSOTW('backend', week, ratingsModel, backendSOTWModel);
        // Select SOTW for Frontend stack
        const selectedFrontendSOTW = await selectSOTW('frontend', week, ratingsModel, frontendSOTWModel);
        // Select SOTW for Product Design stack
        const selectedProductSOTW = await selectSOTW('productdesign', week, ratingsModel, productSOTWModel);

        // Return successful response with selected SOTW for each stack
        return res.status(200).json({
            message: "Student of the week successfully selected for the following stacks:",
            Backend: selectedBackendSOTW,
            Frontend: selectedFrontendSOTW,
            ProductDesign: selectedProductSOTW,
        });
    } catch (error) {
        // Return error response if any error occurs during the process
        return res.status(500).json({ message: "Internal Server Error: " + error.message });
    }
};


//Function to handle fetching SOTW by stack and week
const SOTWbyWeek = async (stack, week, SOTWmodel) => {

    // fetch SOTW for all stacks
    const SOTW = await SOTWmodel.findOne({ week: week }).populate('student');

    if (!SOTW || SOTM.length === 0) {
        throw new Error(`${stack} SOTW was not found for week ${week}!`);
    }

    return SOTW;
}



//Function to view the SOTW for a particular week and for all stacks
const viewSOTW = async (req, res) => {
    try {
        const week = req.body.week;

        // fetch SOTW for Backend stack
        const BackendSOTW = await SOTWbyWeek('backend', week, backendSOTWModel);
        // fetch SOTW for Frontend stack
        const FrontendSOTW = await SOTWbyWeek('frontend', week, frontendSOTWModel);
        // fetch SOTW for Product Design stack
        const ProductSOTW = await SOTWbyWeek('productdesign', week, productSOTWModel);

        return res.status(200).json({
            message: "Student of the week successfully fetched for the following stacks:",
            Backend: BackendSOTW,
            Frontend: FrontendSOTW,
            ProductDesign: ProductSOTW,
        });

    } catch (error) {
        return res.status(500).json({
            message: "Internal Server Error: " + error.message,
        })
    }
}



// Function to handle fetching SOTW by stack
const allSOTW = async (stack, SOTWmodel) => {

    // fetch all SOTW data
    const SOTW = await SOTWmodel.find().sort({ createdAt: -1 }).populate('student');

    if (!SOTW || SOTW.length === 0) {
        throw new Error(`${stack} SOTW was not found!`);
    }

    return SOTW;
}


//Function to view all the SOTW for all stacks
const viewAllSOTW = async (req, res) => {
    try {
        // fetch SOTW for Backend stack
        const BackendSOTW = await allSOTW('backend', backendSOTWModel);
        // fetch SOTW for Frontend stack
        const FrontendSOTW = await allSOTW('frontend', frontendSOTWModel);
        // fetch SOTW for Product Design stack
        const ProductSOTW = await allSOTW('productdesign', productSOTWModel);

        return res.status(200).json({
            message: "Student of the Week successfully fetched for the following stacks:",
            Backend: BackendSOTW,
            Frontend: FrontendSOTW,
            ProductDesign: ProductSOTW,
        });

    } catch (error) {
        return res.status(500).json({
            message: "Internal Server Error: " + error.message,
        })
    }
}



//Function to delete a backend SOTW document
const deleteSOTWb = async (req, res) => {
    try {
        const sotwId = req.params.sotwId
        const sotwB = await backendSOTWModel.findById(sotwId);
        if (!sotwB) {
            return res.status(404).json({
                message: "Backend SOTW not found",
            })
        }

        const deleteSOTWb = await backendSOTWModel.findByIdAndDelete(sotwId);
        if (!deleteSOTWb) {
            return res.status(400).json({
                message: "Unable to delete Backend SOTW Data"
            });
        }

        return res.status(200).json({
            message: "SOTW data for backend deleted successfully",
        })

    } catch (error) {
        return res.status(500).json({
            message: "Internal Server Error: " + error.message,
        })
    }
}


//Function to delete a frontend SOTW document
const deleteSOTWf = async (req, res) => {
    try {
        const sotwId = req.params.sotwId
        const sotwF = await frontendSOTWModel.findById(sotwId);
        if (!sotwF) {
            return res.status(404).json({
                message: "Frontend SOTW not found",
            })
        }

        const deleteSOTWf = await frontendSOTWModel.findByIdAndDelete(sotwId);
        if (!deleteSOTWf) {
            return res.status(400).json({
                message: "Unable to delete Frontend SOTW Data"
            });
        }

        return res.status(200).json({
            message: "SOTW data for frontend deleted successfully",
        })

    } catch (error) {
        return res.status(500).json({
            message: "Internal Server Error: " + error.message,
        })
    }
}



//Function to delete a Product design SOTW document
const deleteSOTWp = async (req, res) => {
    try {
        const sotwId = req.params.sotwId
        const sotwP = await productSOTWModel.findById(sotwId);
        if (!sotwP) {
            return res.status(404).json({
                message: "Product design SOTW not found",
            })
        }

        const deleteSOTWp = await productSOTWModel.findByIdAndDelete(sotwId);
        if (!deleteSOTWp) {
            return res.status(400).json({
                message: "Unable to delete Product design SOTW Data"
            });
        }

        return res.status(200).json({
            message: "SOTW data for product design deleted successfully",
        })

    } catch (error) {
        return res.status(500).json({
            message: "Internal Server Error: " + error.message,
        })
    }
}






module.exports = {
    createRating,
    getRating,
    getAllRating,
    updateRating,
    deleteRating,
    SOTW,
    viewSOTW, 
    viewAllSOTW,
    deleteSOTWb, 
    deleteSOTWf, 
    deleteSOTWp

}