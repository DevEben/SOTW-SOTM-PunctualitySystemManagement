const userModel = require("../model/userModel");
const dataModel = require("../model/dataModel");
const assessmentModel = require("../model/assessmentModel");
const { validateUser, validateUserLogin, validateUserLocation, } = require("../middleware/validator");
const bcrypt = require("bcrypt");
const Jimp = require("jimp");
const sendMail = require("../utils/email");
const cloudinary = require("../middleware/cloudinary");
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { format, getWeek } = require('date-fns');
const { generateDynamicEmail } = require("../utils/emailText");
const { resetFunc } = require('../utils/forgot');
const resetHTML = require('../utils/resetHTML');
require('dotenv').config();



//Function to register a new user
const signUp = async (req, res) => {
    try {
        const { error } = validateUser(req.body);
        if (error) {
            return res.status(500).json({
                message: error.details[0].message
            })
        } else {
            const toTitleCase = (inputText) => {
                let word = inputText.toLowerCase()
                let firstWord = word.charAt(0).toUpperCase()

                return firstWord + (word.slice(1))
            }
            const userData = {
                firstName: req.body.firstName.trim(),
                lastName: req.body.lastName.trim(),
                email: req.body.email.trim(),
                stack: req.body.stack.trim(),
                cohort: req.body.cohort,
                password: req.body.password.trim(),
            }

            const emailExists = await userModel.findOne({ email: userData.email.toLowerCase() });
            if (emailExists) {
                return res.status(200).json({
                    message: 'Email already exists',
                })
            }
            const salt = bcrypt.genSaltSync(12)
            const hashpassword = bcrypt.hashSync(userData.password, salt);

            const user = await new userModel({
                firstName: toTitleCase(userData.firstName),
                lastName: toTitleCase(userData.lastName),
                email: userData.email.toLowerCase(),
                stack: userData.stack.toLowerCase(),

                cohort: userData.cohort,
                password: hashpassword,
            });
            if (!user) {
                return res.status(404).json({
                    message: 'User not found',
                })
            }
            const token = jwt.sign({
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
            }, process.env.SECRET, { expiresIn: "300s" });

            user.token = token;
            const subject = 'Email Verification'
            const link = `${req.protocol}://${req.get('host')}/api/v1/verify/${user.id}/${user.token}`

            const html = generateDynamicEmail(user.firstName, link)
            sendMail({
                email: user.email,
                html,
                subject
            })
            await user.save()

            return res.status(200).json({
                message: 'User profile created successfully',
                data: user,
            })

        }
    } catch (error) {
        return res.status(500).json({
            message: "Internal server error: " + error.message,
        })
    }
};



//Function to verify a new user with a link
const verify = async (req, res) => {
    try {
        const id = req.params.id;
        const token = req.params.token;
        const user = await userModel.findById(id);

        // Verify the token
        jwt.verify(token, process.env.SECRET);

        // Update the user if verification is successful
        const updatedUser = await userModel.findByIdAndUpdate(id, { isVerified: true }, { new: true });
        res.status(200).send("<h4>You have been successfully verified. Kindly visit the login page.</h4> <script>setTimeout(() => { window.location.href = '/api/v1/login'; }, 5000);</script>");
        return;

    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            // Handle token expiration
            const id = req.params.id;
            const updatedUser = await userModel.findById(id);
            //const { firstName, lastName, email } = updatedUser;
            const newtoken = jwt.sign({ email: updatedUser.email, firstName: updatedUser.firstName, lastName: updatedUser.lastName }, process.env.SECRET, { expiresIn: "300s" });
            updatedUser.token = newtoken;
            updatedUser.save();

            const link = `${req.protocol}://${req.get('host')}/api/v1/verify/${id}/${updatedUser.token}`;
            sendMail({
                email: updatedUser.email,
                html: generateDynamicEmail(updatedUser.firstName, link),
                subject: "RE-VERIFY YOUR ACCOUNT"
            });
            res.status(401).send("<h4>This link is expired. Kindly check your email for another email to verify.</h4><script>setTimeout(() => { window.location.href = '/api/v1/login'; }, 5000);</script>");
            return;
        } else {
            return res.status(500).json({
                message: "Internal server error: " + error.message,
            });
        }
    }
};


//Function to login a verified user
const logIn = async (req, res) => {
    try {
        const { error } = validateUserLogin(req.body);
        if (error) {
            return res.status(500).json({
                message: error.details[0].message
            })
        } else {
            const { email, password } = req.body;
            const checkEmail = await userModel.findOne({ email: email.toLowerCase() });
            if (!checkEmail) {
                return res.status(404).json({
                    message: 'User not registered'
                });
            }
            const checkPassword = bcrypt.compareSync(password, checkEmail.password);
            if (!checkPassword) {
                return res.status(404).json({
                    message: "Password is incorrect"
                })
            }
            const token = jwt.sign({
                userId: checkEmail._id,
            }, process.env.SECRET, { expiresIn: "5h" });

            checkEmail.token = token;
            await checkEmail.save();

            if (checkEmail.isVerified === true) {
                return res.status(200).json({
                    message: "Login Successfully! Welcome " + checkEmail.firstName + " " + checkEmail.lastName,
                    token: token
                })
            } else {
                return res.status(400).json({
                    message: "Sorry user not verified yet."
                })
            }
        }

    } catch (error) {
        return res.status(500).json({
            message: "Internal server error: " + error.message,
        });
    }
};


//Function for the user incase password is forgotten
const forgotPassword = async (req, res) => {
    try {
        const checkUser = await userModel.findOne({ email: req.body.email });
        if (!checkUser) {
            return res.status(404).json({
                message: 'Email does not exist'
            });
        }
        else {
            const subject = 'Kindly reset your password'
            const link = `${req.protocol}://${req.get('host')}/api/v1/reset/${checkUser.id}`
            const html = resetFunc(checkUser.firstName, link)
            sendMail({
                email: checkUser.email,
                html,
                subject
            })
            return res.status(200).json({
                message: "Kindly check your email to reset your password",
            })
        }
    } catch (error) {
        return res.status(500).json({
            message: 'Internal Server Error: ' + error.message,
        })
    }
};

//Funtion to send the reset Password page to the server
const resetPasswordPage = async (req, res) => {
    try {
        const userId = req.params.userId;
        const resetPage = resetHTML(userId);

        // Send the HTML page as a response to the user
        res.send(resetPage);
    } catch (error) {
        return res.status(500).json({
            message: 'Internal Server Error: ' + error.message,
        });
    }
};



//Function to reset the user password
const resetPassword = async (req, res) => {
    try {
        const userId = req.params.userId;
        const password = req.body.password;

        if (!password) {
            return res.status(400).json({
                message: "Password cannot be empty",
            });
        }

        const salt = bcrypt.genSaltSync(12);
        const hashPassword = bcrypt.hashSync(password, salt);

        const reset = await userModel.findByIdAndUpdate(userId, { password: hashPassword }, { new: true });
        return res.status(200).json({
            message: "Password reset successfully",
        });
    } catch (error) {
        return res.status(500).json({
            message: 'Internal Server Error: ' + error.message,
        })
    }
};



//Function to signOut a user
const signOut = async (req, res) => {
    try {
        const userId = req.user.userId
        const newUser = await userModel.findById(userId)
        if (!newUser) {
            return res.status(404).json({
                message: 'User not found'
            });
        }

        newUser.token = null;
        await newUser.save();
        return res.status(201).json({
            message: `user has been signed out successfully`
        })
    }
    catch (error) {
        return res.status(500).json({
            message: 'Internal Server Error: ' + error.message,
        })
    }
}



// //Endpoint to get the assessment for each student by the reviewer
// const assessmentData = async (req, res) => {
//     try {
//         // Get attendance data grouped by user ID and week
//         const aggregatedData = await dataModel.aggregate([
//             {
//                 $addFields: {
//                     date: { $toDate: "$date" } // Convert string date to date object
//                 }
//             },
//             {
//                 $group: {
//                     _id: {
//                         userId: '$userId',
//                         week: { $isoWeek: '$date' } // Group by ISO week of the year
//                     },
//                     averagePunctualityScore: { $avg: '$punctualityScore' },
//                     weeklyData: { $push: '$$ROOT' } // Push each document into weeklyData array
//                 }
//             }
//         ]);

//         // Format the response
//         const formattedData = aggregatedData.map(item => ({
//             userId: item._id.userId,
//             week: item._id.week,
//             averagePunctualityScore: item.averagePunctualityScore,
//             weeklyData: item.weeklyData
//         }));

//         // Save the assessment data
//         const savedAssessmentData = [];
//         for (const item of formattedData) {
//             const assessment = await assessmentModel.create({
//                 userId: item.userId,
//                 week: item.week,
//                 averagePunctualityScore: item.averagePunctualityScore,
//                 weeklyData: item.weeklyData
//             });
//             savedAssessmentData.push(assessment);
//         }

//         // Delete documents with dates falling within the current week
//         const currentDate = new Date();
//         const startOfWeek = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - currentDate.getDay());
//         const endOfWeek = new Date(startOfWeek);
//         endOfWeek.setDate(startOfWeek.getDate() + 6);

//         await dataModel.deleteMany({
//             date: {
//                 $gte: startOfWeek.toISOString().split('T')[0],
//                 $lt: endOfWeek.toISOString().split('T')[0]
//             }
//         });

//         // Delete the associated image file from Cloudinary
//         const publicId = savedAssessmentData.map(item => item.image.public_id);
//         await cloudinary.uploader.destroy(publicId);

//         // Return the formatted data
//         return res.status(200).json({
//             message: "Assessment data fetched successfully",
//             data: savedAssessmentData
//         });
//     } catch (error) {
//         return res.status(500).json({
//             message: 'Internal Server Error: ' + error.message
//         });
//     }
// };









module.exports = {
    signUp,
    verify,
    logIn,
    forgotPassword,
    resetPasswordPage,
    resetPassword,
    signOut,

    // assessmentData,

}