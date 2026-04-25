const adminSettingsModel = require("../../models/adminSettingsModel");
const NavMenu = require("../../models/navMenuModel");
const { responseReturn } = require("../../utiles/response");
const fs = require('fs');
const path = require('path');

class configController {
    get_initial_data = async (req, res) => {
        try {
            const languages = [
                { id: 'en', name: 'English', native: 'English' },
                { id: 'ta', name: 'Tamil', native: 'தமிழ்' },
                { id: 'hi', name: 'Hindi', native: 'हिन्दी' },
                { id: 'te', name: 'Telugu', native: 'తెలుగు' },
                { id: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ' },
                { id: 'ml', name: 'Malayalam', native: 'മലയാളം' }
            ];

            const versioning = {
                currentVersion: '1.0.0',
                minRequiredVersion: '1.0.0',
                forceUpdate: false,
                androidLink: 'https://play.google.com/store/apps/details?id=com.jeenora.app',
                iosLink: 'https://apps.apple.com/app/jeenora/id123456789'
            };

            // Fetch Wear Settings
            const wearSetting = await adminSettingsModel.findOne({ settingKey: 'wear_config' });
            const wearConfig = wearSetting ? wearSetting.settingValue : {};

            // Ensure default structure
            if (wearConfig.min_online_payment_amount === undefined) {
                wearConfig.min_online_payment_amount = 0;
            }

            // Fetch common business types
            const businessTypes = [
                { id: 'retail', name: 'Retailer', description: 'Sell directly to customers' },
                { id: 'wholesale', name: 'Wholesaler', description: 'Sell in bulk to other businesses' },
                { id: 'manufacturer', name: 'Manufacturer', description: 'Produce and sell your own goods' }
            ];

            const paymentKeys = {
                razorpayKeyId: process.env.RAZORPAY_KEY_ID,
                cashfreeAppId: process.env.CASHFREE_APP_ID,
                cashfreeEnvironment: process.env.CASHFREE_ENVIRONMENT || 'SANDBOX'
            };

            responseReturn(res, 200, {
                languages,
                versioning,
                wearConfig,
                businessTypes,
                paymentKeys,
                success: true
            });
        } catch (error) {
            responseReturn(res, 500, { error: error.message });
        }
    }

    get_nav_menu = async (req, res) => {
        const { platform } = req.params;
        try {
            // 1. Try fetching from DB
            let menu = await NavMenu.findOne({ platform });

            if (!menu) {
                // 2. Fallback to config file
                const configPath = path.join(__dirname, '../../config/data/menuConfig.json');
                if (fs.existsSync(configPath)) {
                    const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                    const platformItems = configData[platform];
                    
                    if (platformItems) {
                        // Transform to DB structure if it was a flat list
                        // For supplier, it's already an array of sections in my JSON
                        const sections = platform === 'supplier' ? platformItems : [{ title: 'Main', items: platformItems }];
                        
                        // Optionally seed the DB automatically
                        menu = await NavMenu.create({ platform, sections });
                    }
                }
            }

            responseReturn(res, 200, {
                menu: menu ? menu.sections : [],
                platform,
                success: true
            });

        } catch (error) {
            console.error('[CONFIG_CONTROLLER] Get Nav Menu Error:', error.message);
            responseReturn(res, 500, { error: 'Failed to load navigation menu', success: false });
        }
    }

    update_nav_menu = async (req, res) => {
        const { platform, sections } = req.body;
        try {
            // 1. Update/Create in DB
            const menu = await NavMenu.findOneAndUpdate(
                { platform },
                { sections },
                { upsert: true, new: true }
            );

            // 2. Write to JSON file (The "server la file wright panu" requirement)
            const configPath = path.join(__dirname, '../../config/data/menuConfig.json');
            
            let configData = {};
            if (fs.existsSync(configPath)) {
                configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            }
            
            configData[platform] = sections;
            
            fs.writeFileSync(configPath, JSON.stringify(configData, null, 4));

            responseReturn(res, 200, {
                message: 'Menu updated and synchronized to server file successfully',
                menu: menu.sections,
                success: true
            });

        } catch (error) {
            console.error('[CONFIG_CONTROLLER] Update Menu Error:', error.message);
            responseReturn(res, 500, { error: error.message, success: false });
        }
    }
}

module.exports = new configController();
