const axios = require('axios');

async function test() {
    try {
        const response = await axios.get('http://localhost:5000/api/wear/home/customer/ai/personalized-recommendations');
        console.log('Response Status:', response.status);
        console.log('Response Data:', response.data);
    } catch (error) {
        if (error.response) {
            console.log('Error Status:', error.response.status);
            console.log('Error Data:', error.response.data);
        } else {
            console.log('Error Message:', error.message);
        }
    }
}

test();
