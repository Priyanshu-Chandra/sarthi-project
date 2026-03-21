const { generateAIResponse } = require('./services/aiService');
require('dotenv').config();

generateAIResponse('explain the binary search')
  .then(console.log)
  .catch(err => console.error('Error:', err.message));
