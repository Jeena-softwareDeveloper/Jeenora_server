const swaggerAutogen = require('swagger-autogen')();

const doc = {
  openapi: "3.0.0",
  info: {
    title: 'Jeenora Hire API',
    description: 'API Documentation for Jeenora Hire Backend',
    version: "1.0.0",
  },
  servers: [
    { url: "http://localhost:5000", description: "Local Server" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Add: Bearer <token>"
      }
    }
  },
  security: [{ bearerAuth: [] }]
};

const outputFile = './swagger-output.json';
const routes = [
  './server.js',
  './routes/hire/hireAuthRoutes.js',
  './routes/hire/jobRoutes.js',
  './routes/hire/hireUserRoutes.js',
  './routes/hire/resumeRequestRoutes.js',
  './routes/hire/interviewRoutes.js',
  './routes/hire/employerRoutes.js'
]; // scans all your routes

swaggerAutogen(outputFile, routes).then(() => {
  console.log("📘 Swagger file generated");
});
