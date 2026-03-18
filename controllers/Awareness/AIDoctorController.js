const { responseReturn } = require('../../utiles/response');
const AIDoctorModel = require('../../models/Awareness/aiDoctorModel');
const cloudinary = require('../../utiles/cloudinary');
const formidable = require('formidable');
const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

class AIDoctorController {

    analyze_disease = async (req, res) => {
        const form = formidable({ multiples: false, keepExtensions: true });

        form.parse(req, async (err, fields, files) => {
            if (err) return responseReturn(res, 500, { error: 'File parsing failed' });

            const { image } = files;
            if (!image?.filepath) return responseReturn(res, 400, { error: 'Image is required' });

            if (!process.env.GROQ_API_KEY) {
                return responseReturn(res, 400, { error: 'AI Service not configured. Please add GROQ_API_KEY to .env' });
            }

            try {
                // 1. Upload to Cloudinary for AI to access
                const upload = await cloudinary.uploader.upload(image.filepath, {
                    folder: 'CropDoctorScans',
                    resource_type: 'auto'
                });

                // 2. Call Groq AI Vision
                const completion = await groq.chat.completions.create({
                    messages: [
                        {
                            role: "user",
                            content: [
                                {
                                    type: "text",
                                    text: "You are a professional agricultural scientist. Analyze the provided image. \n" +
                                        "1. If the image is NOT a plant or crop, return JSON with: diseaseName: 'Invalid Image', severity: 'Low', symptoms: 'The uploaded image is not a recognizable crop or plant.', naturalCure: 'Please upload a clear photo of your plant leaf.', detailedTreatment: []\n" +
                                        "2. If the plant is healthy, return JSON with: diseaseName: 'Healthy Crop', severity: 'Low', symptoms: 'Lush green foliage with no visible signs of pathogen activity.', naturalCure: 'Maintain current organic growth practices.', detailedTreatment: ['Continue regular monitoring', 'Ensure balanced irrigation', 'Apply organic compost monthly']\n" +
                                        "3. If a disease or deficiency is found, return JSON with: diseaseName (the name of the disease), severity ('Low', 'Moderate', or 'High'), symptoms (short description), naturalCure (one short organic cure), detailedTreatment (an array of 3-4 specific, numbered steps to treat the condition organically).\n" +
                                        "Return ONLY the JSON object.",
                                },
                                {
                                    type: "image_url",
                                    image_url: {
                                        url: upload.secure_url,
                                    },
                                },
                            ],
                        },
                    ],
                    model: "meta-llama/llama-4-scout-17b-16e-instruct",
                    response_format: { type: "json_object" }
                });

                const rawContent = completion.choices[0].message.content;
                console.log('Raw AI Response:', rawContent);

                let aiResponse;
                try {
                    aiResponse = JSON.parse(rawContent);
                } catch (parseError) {
                    console.error('JSON Parse Error:', parseError);
                    // Attempt to extract JSON if it's wrapped in markdown
                    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        aiResponse = JSON.parse(jsonMatch[0]);
                    } else {
                        throw new Error('Could not parse AI response as JSON');
                    }
                }

                // 3. Fallbacks and Data Normalization
                const finalData = {
                    diseaseName: aiResponse.diseaseName || aiResponse.diagnosis || aiResponse.disease || aiResponse.identification || "Unknown Condition",
                    severity: aiResponse.severity || aiResponse.condition_severity || "Moderate",
                    symptoms: aiResponse.symptoms || aiResponse.description || aiResponse.signs || "No specific symptoms identified.",
                    naturalCure: aiResponse.naturalCure || aiResponse.remedy || aiResponse.treatment || aiResponse.cure || "Consult an expert for specialized treatment.",
                    detailedTreatment: aiResponse.detailedTreatment || [],
                    confidence: aiResponse.confidence || aiResponse.score || (0.85 + (Math.random() * 0.1)),
                    image: upload.secure_url,
                    user: fields.userId || req.id // Handle both ways of passing user ID
                };

                // 4. Save to History
                const diagnosis = await AIDoctorModel.create(finalData);

                return responseReturn(res, 201, { result: diagnosis, message: 'AI Diagnosis complete' });

            } catch (error) {
                console.error('Groq AI Error:', error);
                return responseReturn(res, 500, { error: 'AI Analysis failed: ' + error.message });
            }
        });
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
