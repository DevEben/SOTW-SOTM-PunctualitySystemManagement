const userModel = require("../model/userModel");
const dataModel = require("../model/dataModel");
const assessmentModel = require("../model/assessmentModel");
const { validateUserLocation, } = require("../middleware/validator");
const Jimp = require("jimp");
const cloudinary = require("../middleware/cloudinary");
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const _ = require('lodash');
require('dotenv').config();


// Function to handle the attendance of students
const checkIn = async (req, res) => {
    try {
        // Validate user input
        // const { error } = validateUserLocation(req.body);
        // if (error) {
        //     return res.status(400).json({ message: error.details[0].message });
        // }
        const today = new Date();

        //Checks if that day is Monday, Wednesday, or Friday (Days for classes)
        if (today.getDay() === 1 || today.getDay() === 3 || today.getDay() === 5) {
            const userId = req.user.userId;
            const user = await userModel.findById(userId);
            if (!user) {
                return res.status(404).json({ message: "User not found" });
            }

            const { latitude, longitude } = req.body;


            // // Call Mapbox Geocoding API to get place name
            // const accessToken = process.env.accessToken;
            // const geocodingUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${accessToken}`;

            // const response = await fetch(geocodingUrl);
            // if (!response.ok) {
            //     return res.status(400).json({message: 'Failed to fetch place name'});
            // }
            // const data = await response.json();
            // const location = data.features[0].place_name;


            const apiUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`;

            const response = await fetch(apiUrl);
            const data = await response.json();

            if (!response.ok) {
                return res.status(400).json({ message: `Failed to fetch location ${response.statusText}` });
            }

            // Extract the address from the response
            const location = data.display_name;

            // const location = req.body.location.toLowerCase();

            if (!location) {
                return res.status(400).json({
                    message: "Please enter a valid location"
                });
            }

            // Check if an image is uploaded
            if (!req.files || !req.files.image) {
                return res.status(400).json({ message: 'No image provided' });
            }

            const image = req.files.image;

            // Check if only one file is uploaded
            if (Array.isArray(image)) {
                return res.status(400).json({ message: "Please upload only one image file" });
            }

            // Check file extension
            const fileExtension = path.extname(image.name).toLowerCase();
            const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif'];
            if (!allowedExtensions.includes(fileExtension)) {
                return res.status(400).json({
                    message: 'Only image files are allowed'
                });
            }

            // Read the image with Jimp and add watermark
            const jimpImage = await Jimp.read(image.tempFilePath);
            const font = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);
            const date = today.toISOString().split('T')[0];
            const time = today.toLocaleTimeString('en-US', { hour12: true });
            jimpImage.print(font, 10, 10, `${location}, \n${date},  ${time}`);

            // Convert Jimp image to buffer
            const modifiedImageBuffer = await jimpImage.getBufferAsync(Jimp.MIME_JPEG); // or use the appropriate MIME type for your image format

            const checkInStatus = await dataModel.findOne({ date: date });
            if (checkInStatus && checkInStatus.userId === userId) {
                return res.status(400).json({
                    message: "Sorry you can only checkIn once per day!"
                })
            }

            // Upload modified image to Cloudinary
            const cloudinaryUpload = await cloudinary.uploader.upload_stream({ folder: "AttendanceData-Image" },
                (error, result) => {
                    if (error) {
                        return res.status(500).json({ message: 'An error occurred while uploading the image' });
                    }
                    // Delete the temporary file
                    fs.unlinkSync(image.tempFilePath);

                    let score;

                    let newTime = today.toLocaleTimeString('en-US', { hour12: false });

                    if (newTime > "10:00:00") {
                        score = 0;
                    } else if (newTime <= "10:00:00" && newTime >= "09:46:00") {
                        score = 10;
                    } else if (newTime <= "09:45:00" && newTime >= "00:00:00") {
                        score = 20;
                    } else {
                        score = 0;
                    }


                    // Save attendance data
                    const userData = new dataModel({
                        userId: userId,
                        location,
                        time,
                        date,
                        image: {
                            public_id: result.public_id,
                            url: result.secure_url,
                        },
                        punctualityScore: score,
                    });

                    userData.save();
                    user.data.push(userData);
                    user.save();

                    return res.status(200).json({
                        message: 'User data created successfully',
                        Data: userData
                    });
                }).end(modifiedImageBuffer);
        } else {
            return res.status(400).json({
                message: "Sorry you can't checkIn today!"
            });
        }

    } catch (error) {
        return res.status(500).json({
            message: 'Internal Server Error: ' + error.message,
        });
    }
};




// Endpoint to get the assessment for each student by the reviewer
const assessmentData = async (req, res) => {
    try {
        // Get the current date
        const currentDate = new Date();

        // Calculate the start of the current week
        const startOfWeek = new Date(currentDate);
        startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

        // Calculate the end of the current week
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        //Check if it's Friday or Weekend to review punctuality score
        if (currentDate.getDay() < 5) {
            return res.status(400).json({
                message: "Sorry you can't review punctuality score till Friday or Saturday"
            })
        }

        const checkAssessment = await assessmentModel.findOne({ weekStart: startOfWeek.toISOString().split('T')[0] });
        if (checkAssessment) {
            return res.status(400).json({
                message: "Sorry! you've already reviewed punctuality score for this week"
            })
        }

        // Fetch attendance data for the current week
        const attendanceData = await dataModel.find({
            date: {
                $gte: startOfWeek.toISOString().split('T')[0],
                $lt: endOfWeek.toISOString().split('T')[0]
            }
        });

        // Function to delete image by public_id
        const deleteImage = async (public_id) => {
            try {
                const result = await cloudinary.uploader.destroy(public_id);
            } catch (error) {
                console.error('Error deleting image:', error.message);
            }
        };

        // Aggregate the attendance data to calculate total score and count for each user
        const aggregatedData = attendanceData.reduce((acc, curr) => {
            const { userId, punctualityScore, image } = curr;

            // If userId doesn't exist in accumulator, initialize it with totalScore and count as 0
            if (!acc[userId]) {
                acc[userId] = { totalScore: 0, count: 0 };
            }

            // Accumulate totalScore and increment count
            acc[userId].totalScore += punctualityScore;
            acc[userId].count++;

            // Delete image associated with the user
            if (image && image.public_id) {
                deleteImage(image.public_id);
            }

            // Update the documents to remove the image field
            Promise.all(attendanceData.map(async (data) => {
                await dataModel.updateOne({ image: image }, { $unset: { image: 1 } });
            }));

            return acc;
        }, {});

        // Prepare assessment data to be saved
        const savedAssessmentData = Object.keys(aggregatedData).map(userId => {
            const { totalScore, count } = aggregatedData[userId];
            const averagePunctualityScore = totalScore / count;
            return {
                userId,
                weekStart: startOfWeek.toISOString().split('T')[0],
                weekEnd: endOfWeek.toISOString().split('T')[0],
                averagePunctualityScore: averagePunctualityScore,
            };
        });

        // Save assessment data to the database
        const savedDocuments = await assessmentModel.create(savedAssessmentData);

        // Return the assessment data
        return res.status(200).json({
            message: "Assessment data fetched successfully",
            data: savedDocuments
        });
    } catch (error) {
        return res.status(500).json({
            message: 'Internal Server Error: ' + error.message,
        });
    }
};



//Function to fetch checkIn data for a student for a particular week
const fetchCheckInWeekly = async (req, res) => {
    try {

        const userId = req.params.userId
        // Get the current date
        const currentDate = new Date();

        // Calculate the start of the current week
        const startOfWeek = new Date(currentDate);
        startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

        // Calculate the end of the current week
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        // Fetch attendance data for the current week
        const attendanceData = await dataModel.find({
            userId: userId,
            date: {
                $gte: startOfWeek.toISOString().split('T')[0],
                $lte: endOfWeek.toISOString().split('T')[0]
            }
        });

        if (!attendanceData) {
            return res.status(400).json({
                message: "Attendance data for student not found",
            })
        }

        return res.status(200).json({
            message: "Student attendance data successfully fetched: ",
            data: attendanceData
        });


    } catch (error) {
        return res.status(500).json({
            message: 'Internal Server Error: ' + error.message,
        });
    }
}


//Function to fetch checkIn data for all student for a particular week and group by their userId
const fetchAllCheckInWeekly = async (req, res) => {
    try {
        // Get the current date
        const currentDate = new Date();

        // Calculate the start of the current week
        const startOfWeek = new Date(currentDate);
        startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

        // Calculate the end of the current week
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

         // Fetch attendance data for the current week
        const attendanceData = await dataModel.find({
        date: {
                $gte: startOfWeek.toISOString().split('T')[0],
                $lte: endOfWeek.toISOString().split('T')[0]
        }
        });

        if (!attendanceData || attendanceData.length === 0) {
            return res.status(400).json({
                message: "Attendance data for student not found",
            })
        }

        // Group attendance data by userId using lodash's groupBy function
        const groupedData = _.groupBy(attendanceData, 'userId');

        return res.status(200).json({
            message: "Student attendance data successfully fetched: ",
            data: groupedData
        });


    } catch (error) {
        return res.status(500).json({
            message: 'Internal Server Error: ' + error.message,
        });
    }
}



//Function to fetch weekly assessment data for students
const fetchAssessmentData = async (req, res) => {
    try {
        // Get the current date
        const currentDate = new Date();

        // Calculate the start of the current week
        const startOfWeek = new Date(currentDate);
        startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

        // Calculate the end of the current week
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        // Fetch attendance data for the current week
        const assessmentData = await assessmentModel.find({
            weekStart: {
                $gte: startOfWeek.toISOString().split('T')[0],
                $lte: endOfWeek.toISOString().split('T')[0]
            },
            weekEnd: {
                $gte: startOfWeek.toISOString().split('T')[0],
                $lte: endOfWeek.toISOString().split('T')[0]
            },
        });

        if (!assessmentData) {
            return res.status(400).json({
                message: "Assessment data for students not found",
            })
        }

        return res.status(200).json({
            message: "Students assessment data successfully fetched: ",
            data: assessmentData
        });

    } catch (error) {
        return res.status(500).json({
            message: 'Internal Server Error: ' + error.message,
        });
    }
};



//Function to fetch weekly assessment data for a particular student
const fetchOneAssessmentData = async (req, res) => {
    try {
        const userId = req.params.userId;
        // Get the current date
        const currentDate = new Date();

        // Calculate the start of the current week
        const startOfWeek = new Date(currentDate);
        startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

        // Calculate the end of the current week
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        // Fetch attendance data for the current week
        const assessmentData = await assessmentModel.findOne({
            userId: userId,
            weekStart: {
                $gte: startOfWeek.toISOString().split('T')[0],
                $lte: endOfWeek.toISOString().split('T')[0]
            },
            weekEnd: {
                $gte: startOfWeek.toISOString().split('T')[0],
                $lte: endOfWeek.toISOString().split('T')[0]
            },
        });

        if (!assessmentData) {
            return res.status(400).json({
                message: `Assessment data for student with ID: ${userId} not found`,
            })
        }

        return res.status(200).json({
            message: "Student assessment data successfully fetched: ",
            data: assessmentData
        });

    } catch (error) {
        return res.status(500).json({
            message: 'Internal Server Error: ' + error.message,
        });
    }
};



//Function to delete a student checkIn Data
const deleteCheckIn = async (req, res) => {
    try {
        const checkInID = req.params.checkInID;

        const checkInData = await dataModel.findById(checkInID);
        if (!checkInData) {
            return res.status(404).json({
                message: "CheckIn data not found"
            })
        }

        const deleteCheckInData = await dataModel.findByIdAndDelete(checkInID);
        if (!deleteCheckInData) {
            return res.status(400).json({
                message: "Unable to delete student checkIn Data"
            });
        }

        return res.status(200).json({
            message: "Student checkIn data deleted successfully",
        })

    } catch (error) {
        return res.status(500).json({
            message: 'Internal Server Error: ' + error.message,
        });
    }
}



//Function to delete a student full week checkIn Data once
const deleteWeekCheckIn = async (req, res) => {
    try {
        const userId = req.params.userId;
        // Get the current date
        const currentDate = new Date();

        // Calculate the start of the current week
        const startOfWeek = new Date(currentDate);
        startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

        // Calculate the end of the current week
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        // Fetch attendance data for the current week
        const checkInData = await dataModel.find({
            userId: userId,
            date: {
                $gte: startOfWeek.toISOString().split('T')[0],
                $lte: endOfWeek.toISOString().split('T')[0]
            }
        });

        if (!checkInData || checkInData.length === 0) {
            return res.status(404).json({
                message: "CheckIn data not found"
            })
        }

        const deleteCheckInData = await dataModel.deleteMany({
            userId: userId,
            date: {
                $gte: startOfWeek.toISOString().split('T')[0],
                $lte: endOfWeek.toISOString().split('T')[0]
            }
        });
        if (!deleteCheckInData) {
            return res.status(400).json({
                message: "Unable to delete student checkIn Data"
            });
        }

        return res.status(200).json({
            message: "Student checkIn data deleted successfully",
        })

    } catch (error) {
        return res.status(500).json({
            message: 'Internal Server Error: ' + error.message,
        });
    }
}



//Function to delete a reviewed assessment for a particular student
const deleteAssessment = async (req, res) => {
    try {
        const assessmentId = req.params.assessmentId;

        const assessment = await assessmentModel.findById(assessmentId);
        if (!assessment) {
            return res.status(404).json({
                message: "Assessment data for the student not found"
            })
        }

        const deleteAssessment = await assessmentModel.findByIdAndDelete(assessmentId);
        if (!deleteAssessment) {
            return res.status(400).json({
                message: "Unable to delete student assessment Data"
            });
        }

        return res.status(200).json({
            message: "Student assessment data deleted successfully",
        })

    } catch (error) {
        return res.status(500).json({
            message: 'Internal Server Error: ' + error.message,
        });
    }
}







module.exports = {
    checkIn,
    assessmentData,
    fetchCheckInWeekly,
    fetchAllCheckInWeekly,
    fetchAssessmentData,
    fetchOneAssessmentData,
    deleteCheckIn,
    deleteWeekCheckIn,
    deleteAssessment,

}

