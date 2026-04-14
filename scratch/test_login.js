const axios = require('axios');

async function testLogin() {
    try {
        const response = await axios.post('http://localhost:5000/api/admin-login', {
            email: 'jeenoraofficial@gmail.com',
            password: 'Jeenora.12345'
        });
        console.log('Login Test Success!');
        console.log('Status:', response.status);
        console.log('Data:', response.data);
    } catch (error) {
        console.error('Login Test Failed!');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
}

testLogin();
