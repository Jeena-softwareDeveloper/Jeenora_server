const Ticker = require('../../models/Awareness/tickerModel');
const { responseReturn } = require('../../utiles/response');

class TickerController {
    // Public get
    get_tickers = async (req, res) => {
        try {
            const now = new Date();
            const tickers = await Ticker.find({
                isActive: true
            }).sort({ createdAt: -1 });

            return responseReturn(res, 200, { tickers });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }

    // Admin get
    get_admin_tickers = async (req, res) => {
        try {
            const tickers = await Ticker.find().sort({ createdAt: -1 });
            return responseReturn(res, 200, { tickers });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }

    add_ticker = async (req, res) => {
        try {
            const ticker = await Ticker.create({
                ...req.body,
                isActive: true
            });
            return responseReturn(res, 201, { ticker, message: 'Ticker added successfully' });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }

    update_ticker = async (req, res) => {
        const { id } = req.params;
        try {
            const ticker = await Ticker.findByIdAndUpdate(id, req.body, { new: true });
            if (!ticker) return responseReturn(res, 404, { error: 'Ticker not found' });
            return responseReturn(res, 200, { ticker, message: 'Ticker updated successfully' });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }

    delete_ticker = async (req, res) => {
        const { id } = req.params;
        try {
            await Ticker.findByIdAndDelete(id);
            return responseReturn(res, 200, { message: 'Ticker deleted successfully' });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }

    toggle_status = async (req, res) => {
        const { id } = req.params;
        try {
            const ticker = await Ticker.findById(id);
            if (!ticker) return responseReturn(res, 404, { error: 'Not found' });
            ticker.isActive = !ticker.isActive;
            await ticker.save();
            return responseReturn(res, 200, { ticker, message: 'Status toggled' });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }
}

module.exports = new TickerController();
