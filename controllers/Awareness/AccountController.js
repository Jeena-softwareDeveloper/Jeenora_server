const { responseReturn } = require('../../utiles/response');
const Accounts = require('../../models/Awareness/accountsModel');

class AccountController {

    // Add Account
    add_account = async (req, res) => {
        try {
            const { twitter, facebook, instagram, phoneNumber, email, linkedin, youtube, whatsapp, role, name, area } = req.body;
            const account = await Accounts.create({ twitter, facebook, instagram, phoneNumber, email, linkedin, youtube, whatsapp, role, name, area });
            return responseReturn(res, 201, { account, message: 'Account info added successfully' });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }

    // Get all accounts
    get_accounts = async (req, res) => {
        try {
            const accounts = await Accounts.find().sort({ createdAt: -1 });
            return responseReturn(res, 200, { accounts });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }

    // Get single account
    get_account = async (req, res) => {
        try {
            const account = await Accounts.findById(req.params.id);
            if (!account) return responseReturn(res, 404, { error: 'Account info not found' });
            return responseReturn(res, 200, { account });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }

    // Update account
    update_account = async (req, res) => {
        try {
            const { twitter, facebook, instagram, phoneNumber, email, linkedin, youtube, whatsapp, role, name, area } = req.body;
            const account = await Accounts.findById(req.params.id);
            if (!account) return responseReturn(res, 404, { error: 'Account info not found' });

            if (twitter) account.twitter = twitter;
            if (facebook) account.facebook = facebook;
            if (instagram) account.instagram = instagram;
            if (phoneNumber) account.phoneNumber = phoneNumber;
            if (email) account.email = email;
            if (linkedin) account.linkedin = linkedin;
            if (youtube) account.youtube = youtube;
            if (whatsapp) account.whatsapp = whatsapp;
            if (role) account.role = role;
            if (name) account.name = name;
            if (area) account.area = area;

            await account.save();
            return responseReturn(res, 200, { account, message: 'Account info updated successfully' });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }

    // Delete account
    delete_account = async (req, res) => {
        try {
            const account = await Accounts.findByIdAndDelete(req.params.id);
            if (!account) return responseReturn(res, 404, { error: 'Account info not found' });
            return responseReturn(res, 200, { message: 'Account info deleted successfully' });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }

    // Toggle isActive
    toggle_status = async (req, res) => {
        try {
            const account = await Accounts.findById(req.params.id);
            if (!account) return responseReturn(res, 404, { error: 'Account info not found' });

            account.isActive = !account.isActive;
            await account.save();

            return responseReturn(res, 200, { account, message: `Account is now ${account.isActive ? 'active' : 'inactive'}` });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }
}

module.exports = new AccountController();
