const cloudinary = require("cloudinary").v2;

exports.cloudinaryConnect = () => {
	try {
		cloudinary.config({
			cloud_name: process.env.CLOUD_NAME,
			api_key: process.env.API_KEY,
			api_secret: process.env.API_SECRET,
		});
		console.log('Cloudinary connected successfully')
		console.log("Cloudinary config:", process.env.CLOUD_NAME, process.env.API_KEY);
	} catch (error) {
		console.log(error);
	}
};


