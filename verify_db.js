const mongoose = require('mongoose');

const DB_URL = "mongodb+srv://nutrio:nutrio@cluster0.zvpz4lh.mongodb.net/test";

// Schemas
const hireUserSchema = new mongoose.Schema({
    name: String,
    email: String,
    role: String,
    userType: String,
    settings: {
        account: {
            isActive: Boolean
        }
    },
    createdAt: Date
}, { collection: 'hireusers' }); // Explicit collection name just in case

const HireUser = mongoose.model('HireUser', hireUserSchema);

const hireProfileSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'HireUser' },
    completionPercentage: Number
}); // Implicit collection 'hireprofiles'

async function run() {
    try {
        await mongoose.connect(DB_URL);
        console.log("Connected to DB");

        // 1. Basic Count
        const count = await HireUser.countDocuments({});
        console.log("Total HireUsers:", count);

        // 2. Check Aggregation
        const pipeline = [
            { $match: {} },
            { $sort: { createdAt: -1 } },
            { $limit: 5 },
            {
                $lookup: {
                    from: 'hireprofiles',
                    localField: '_id',
                    foreignField: 'user',
                    as: 'profile'
                }
            }
        ];
        const users = await HireUser.aggregate(pipeline);
        console.log("Aggregated Users Count:", users.length);
        if (users.length > 0) {
            console.log("First User Profile lookup length:", users[0].profile ? users[0].profile.length : 'N/A');
        }

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
}
run();
