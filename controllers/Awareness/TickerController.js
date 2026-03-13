const Ticker = require('../../models/Awareness/tickerModel');
const { responseReturn } = require('../../utiles/response');

class TickerController {
    get_tickers = async (req, res) => {
        try {
            const now = new Date();
            const tickers = await Ticker.find({
                isActive: true,
                startDate: { $lte: now },
                $or: [
                    { endDate: { $exists: false } },
                    { endDate: null },
                    { endDate: { $gte: now } }
                ]
            }).sort({ createdAt: -1 });

            return responseReturn(res, 200, { tickers });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }

    add_ticker = async (req, res) => {
        try {
            const ticker = await Ticker.create(req.body);
            return responseReturn(res, 201, { ticker, message: 'Ticker added' });
        } catch (error) {
            return responseReturn(res, 500, { error: error.message });
        }
    }
}

module.exports = new TickerController();
