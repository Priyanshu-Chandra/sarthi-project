exports.courseUpdateNotificationEmail = (courseName, instructorName, studentName) => {
	const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
	return `<!DOCTYPE html>
	<html>
	
	<head>
		<meta charset="UTF-8">
		<title>Course Content Updated</title>
		<style>
			body {
				background-color: #ffffff;
				font-family: Arial, sans-serif;
				font-size: 16px;
				line-height: 1.4;
				color: #333333;
				margin: 0;
				padding: 0;
			}
	
			.container {
				max-width: 600px;
				margin: 0 auto;
				padding: 20px;
				text-align: center;
			}
	
			.logo {
				max-width: 200px;
				margin-bottom: 20px;
			}
	
			.message {
				font-size: 18px;
				font-weight: bold;
				margin-bottom: 20px;
			}
	
			.body {
				font-size: 16px;
				margin-bottom: 20px;
				text-align: left;
			}
	
			.cta {
				display: inline-block;
				padding: 10px 20px;
				background-color: #FFD60A;
				color: #000000;
				text-decoration: none;
				border-radius: 5px;
				font-weight: bold;
				margin-top: 20px;
			}
	
			.support {
				font-size: 14px;
				color: #999999;
				margin-top: 20px;
			}
	
			.highlight {
				font-weight: bold;
			}
		</style>
	
	</head>
	
	<body>
		<div class="container">
			<a href="${frontendUrl}"><img class="logo" src="https://i.ibb.co/7Xyj3PC/logo.png"
					alt="Sarthi Logo"></a>
			<div class="message">Your Course has been Updated</div>
			<div class="body">
				<p>Hello ${studentName || ""},</p>
				<p>Good news! Your instructor <strong>${instructorName}</strong> has just added new content or lectures to <strong>"${courseName}"</strong> on <span class="highlight">Sarthi</span>.</p>
				<p>Log in to your dashboard to continue your learning journey and explore the new material.</p>
				<a class="cta" href="${frontendUrl}/dashboard/enrolled-courses">Resume Course</a>
			</div>
			<div class="support">If you have any questions or need assistance, please feel free to reach out to us. We are here to help!</div>
		</div>
	</body>
	
	</html>`;
};
