const { responseReturn } = require('../../utiles/response');
const AIDoctorModel = require('../../models/Awareness/aiDoctorModel');

class AIDoctorController {

    analyze_disease = async (req, res) => {
        // Mocking AI Analysis result for demonstration
        const mockResults = [
            { diseaseName: 'Blast Disease', severity: 'High', symptoms: 'Elliptical lesions with white to gray centers and red to brown borders.', naturalCure: 'Apply Pseudomonas fluorescens (10g/L) as foliar spray. Maintain proper field drainage.' },
            { diseaseName: 'Bacterial Blight', severity: 'Moderate', symptoms: 'Water-soaked translucent streaks that eventually turn yellow or white.', naturalCure: 'Spray fresh cow dung extract (5%) twice at 15 days interval. Avoid excessive Nitrogen.' },
            { diseaseName: 'Healthy Crop', severity: 'Low', symptoms: 'No visible lesions or discoloration. Lush green foliage.', naturalCure: 'Continue regular organic nutrition and monitoring.' }
        ];

        const randomResult = mockResults[Math.floor(Math.random() * mockResults.length)];

        try {
            const diagnosis = await AIDoctorModel.create({
                ...randomResult,
                confidence: 0.85 + Math.random() * 0.1,
                image: 'https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg' // Simulated upload
            });
            return responseReturn(res, 201, { result: diagnosis, message: 'Diagnosis complete' });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }

    get_history = async (req, res) => {
        try {
            const history = await AIDoctorModel.find().sort({ createdAt: -1 });
            return responseReturn(res, 200, { history });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }

    delete_record = async (req, res) => {
        const { id } = req.params;
        try {
            await AIDoctorModel.findByIdAndDelete(id);
            return responseReturn(res, 200, { message: 'Report deleted' });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }
}

module.exports = new AIDoctorController();
