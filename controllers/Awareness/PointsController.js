const { responseReturn } = require('../../utiles/response')
const PointsModel = require('../../models/Awareness/pointModels')

class PointsController {

    set_points = async (req, res) => {
        try {
            let points = await PointsModel.findOne()
            if (!points) {
                points = await PointsModel.create({
                    members: req.body.members || 0,
                    guides: req.body.guides || 0,
                    farmersHelped: req.body.farmersHelped || 0,
                    expertAdvisors: req.body.expertAdvisors || 0,
                    success: req.body.success || 0,
                    localFarmersSupport: req.body.localFarmersSupport || 0,
                    localCommunity: req.body.localCommunity || 0,
                    localSources: req.body.localSources || 0
                })
            } else {
                points.members = req.body.members ?? points.members
                points.guides = req.body.guides ?? points.guides
                points.farmersHelped = req.body.farmersHelped ?? points.farmersHelped
                points.expertAdvisors = req.body.expertAdvisors ?? points.expertAdvisors
                points.success = req.body.success ?? points.success
                points.localFarmersSupport = req.body.localFarmersSupport ?? points.localFarmersSupport
                points.localCommunity = req.body.localCommunity ?? points.localCommunity
                points.localSources = req.body.localSources ?? points.localSources
                await points.save()
            }
            return responseReturn(res, 200, { points, message: 'Points updated successfully' })
        } catch (error) {
            return responseReturn(res, 500, { error: error.message })
        }
    }

    get_points = async (req, res) => {
        try {
            const points = await PointsModel.findOne()
            if (!points) {
                return responseReturn(res, 200, {
                    points: {
                        members: 0,
                        guides: 0,
                        farmersHelped: 0,
                        expertAdvisors: 0,
                        success: 0,
                        localFarmersSupport: 0,
                        localCommunity: 0,
                        localSources: 0
                    }
                })
            }
            return responseReturn(res, 200, { points })
        } catch (error) {
            return responseReturn(res, 500, { error: error.message })
        }
    }
}

module.exports = new PointsController()
