const Reward = require('../../models/Awareness/rewardModel');
const Farmer = require('../../models/Awareness/farmerModel');
const { responseReturn } = require('../../utiles/response');

class RewardController {
    
    // Get user points and available rewards
    get_my_points = async (req, res) => {
        try {
            const farmer = await Farmer.findById(req.id);
            if (!farmer) return responseReturn(res, 404, { error: 'Farmer not found' });

            const availableRewards = await Reward.find();
            
            // Dummy milestones for now
            const milestones = [
                { id: 1, title: 'Seed Sower', target: 500, earned: farmer.points >= 500 },
                { id: 2, title: 'Crop Guardian', target: 1500, earned: farmer.points >= 1500 },
                { id: 3, title: 'Harvest King', target: 5000, earned: farmer.points >= 5000 }
            ];

            return responseReturn(res, 200, {
                points: farmer.points || 0,
                milestones,
                availableRewards,
                claimHistory: []
            });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }

    // Claim reward
    claim_reward = async (req, res) => {
        try {
            const { rewardId } = req.params;
            const farmer = await Farmer.findById(req.id);
            if (!farmer) return responseReturn(res, 404, { error: 'Farmer not found' });

            const reward = await Reward.findById(rewardId);
            if (!reward) return responseReturn(res, 404, { error: 'Reward not found' });

            if ((farmer.points || 0) < reward.pointCost) {
                return responseReturn(res, 400, { error: 'Insufficient points' });
            }

            // Deduct points
            farmer.points -= reward.pointCost;
            await farmer.save();

            return responseReturn(res, 200, {
                updatedPoints: farmer.points,
                message: `Successfully claimed ${reward.title}`,
                claim: {
                    rewardId: reward._id,
                    title: reward.title,
                    date: new Date()
                }
            });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }

    // Seed (Initial use)
    seed_rewards = async (req, res) => {
        try {
            await Reward.deleteMany({});
            const items = [
                { title: '₹100 Voucher', description: 'Get ₹100 discount on your next purchase', pointCost: 1000, icon: 'Ticket', type: 'voucher' },
                { title: 'AI Pro Pass', description: 'Unlimited crop specialist consultations for 1 month', pointCost: 2500, icon: 'ShieldCheck', type: 'consultation' },
                { title: 'Pesticide Sample', description: 'Organic pesticide sample for 1 acre', pointCost: 5000, icon: 'Package', type: 'pesticide_sample' },
                { title: 'Golden Farmer Badge', description: 'Showcase your expertise in community posts', pointCost: 500, icon: 'Award', type: 'badge' }
            ];
            await Reward.insertMany(items);
            return responseReturn(res, 201, { message: 'Rewards seeded' });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }
}

module.exports = new RewardController();
