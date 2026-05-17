const partnerModel = require('../../models/partner/Partner')
const customerModel = require('../../models/customer/Customer')
const partnerCustomerModel = require('../../models/chat/partnerCustomerModel')
const partnerCustomerMessage = require('../../models/chat/partnerCustomerMessage')
const adminPartnerMessage = require('../../models/chat/adminPartnerMessage')
const { responseReturn } = require('../../utils/response')

class ChatController {

    add_customer_friend = async (req, res) => {
        const { partnerId, userId, adminId } = req.body
        const targetId = adminId || partnerId

        try {
            if (targetId && targetId !== '') {
                const partner = await partnerModel.findById(targetId)
                const user = await customerModel.findById(userId)
                const checkPartner = await partnerCustomerModel.findOne({
                    $and: [
                        {
                            myId: {
                                $eq: userId
                            }
                        }, {
                            myFriends: {
                                $elemMatch: {
                                    fdId: targetId
                                }
                            }
                        }
                    ]
                })
                if (!checkPartner) {
                    await partnerCustomerModel.updateOne({
                        myId: userId
                    }, {
                        $addToSet: {
                            myFriends: {
                                fdId: targetId,
                                name: partner?.shopInfo?.shopName || partner?.name || 'My Shop',
                                image: partner?.image || ''
                            }
                        }
                    })
                }

                const checkCustomer = await partnerCustomerModel.findOne({
                    $and: [
                        {
                            myId: {
                                $eq: targetId
                            }
                        }, {
                            myFriends: {
                                $elemMatch: {
                                    fdId: userId
                                }
                            }
                        }
                    ]
                })
                if (!checkCustomer) {
                    await partnerCustomerModel.updateOne({
                        myId: targetId
                    }, {
                        $addToSet: {
                            myFriends: {
                                fdId: userId,
                                name: user?.name || 'Customer',
                                image: ""
                            }
                        }
                    })
                }
                const messages = await partnerCustomerMessage.find({
                    $or: [
                        {
                            $and: [{
                                receverId: { $eq: targetId }
                            }, {
                                senderId: {
                                    $eq: userId
                                }
                            }]
                        },
                        {
                            $and: [{
                                receverId: { $eq: userId }
                            }, {
                                senderId: {
                                    $eq: targetId
                                }
                            }]
                        }
                    ]
                })
                const MyFriends = await partnerCustomerModel.findOne({
                    myId: userId
                })
                const currentFd = MyFriends ? MyFriends.myFriends.find(s => s.fdId === targetId) : null
                responseReturn(res, 200, {
                    MyFriends: MyFriends ? MyFriends.myFriends : [],
                    currentFd,
                    messages
                })

            } else {
                const MyFriends = await partnerCustomerModel.findOne({
                    myId: userId
                })
                responseReturn(res, 200, {
                    MyFriends: MyFriends ? MyFriends.myFriends : []
                })
            }

        } catch (error) {
            console.log(error)
        }
    }
    // End Method 

    customer_message_add = async (req, res) => {
        const { userId, text, partnerId, adminId, name } = req.body
        const targetId = adminId || partnerId

        try {
            const message = await partnerCustomerMessage.create({
                senderId: userId,
                senderName: name,
                receverId: targetId,
                message: text
            })

            const data = await partnerCustomerModel.findOne({ myId: userId })
            if (data) {
                let myFriends = data.myFriends
                let index = myFriends.findIndex(f => f.fdId === targetId)
                while (index > 0) {
                    let temp = myFriends[index]
                    myFriends[index] = myFriends[index - 1]
                    myFriends[index - 1] = temp
                    index--
                }
                await partnerCustomerModel.updateOne(
                    {
                        myId: userId
                    },
                    {
                        myFriends
                    }
                )
            }

            const data1 = await partnerCustomerModel.findOne({ myId: targetId })
            if (data1) {
                let myFriends1 = data1.myFriends
                let index1 = myFriends1.findIndex(f => f.fdId === userId)
                while (index1 > 0) {
                    let temp1 = myFriends1[index1]
                    myFriends1[index1] = myFriends1[index1 - 1]
                    myFriends1[index1 - 1] = temp1
                    index1--
                }
                await partnerCustomerModel.updateOne(
                    {
                        myId: targetId
                    },
                    {
                        myFriends: myFriends1
                    }
                )
            }

            responseReturn(res, 201, { message })

        } catch (error) {
            console.log(error)
        }
    }
    // End Method 

    get_customers = async (req, res) => {
        const { partnerId, adminId } = req.params
        const targetId = adminId || partnerId
        try {
            const data = await partnerCustomerModel.findOne({ myId: targetId })
            responseReturn(res, 200, {
                customers: data ? data.myFriends : []
            })
        } catch (error) {
            console.log(error)
        }
    }
    // End Method 

    get_customers_partner_message = async (req, res) => {
        const { customerId } = req.params;
        const { id } = req;
        try {
            const messages = await partnerCustomerMessage.find({
                $or: [
                    {
                        $and: [{ receverId: { $eq: customerId } }, { senderId: { $eq: id } }]
                    },
                    {
                        $and: [{ receverId: { $eq: id } }, { senderId: { $eq: customerId } }]
                    }
                ]
            });

            const currentCustomer = await customerModel.findById(customerId).select('name image phone');
            responseReturn(res, 200, {
                messages,
                currentCustomer: currentCustomer ? {
                    _id: currentCustomer._id,
                    name: currentCustomer.name,
                    image: currentCustomer.image
                } : null
            })

        } catch (error) {
            console.log(error)
        }
    }
    // End Method 

    partner_message_add = async (req, res) => {
        const { senderId, receverId, text, name } = req.body
        try {
            const message = await partnerCustomerMessage.create({
                senderId: senderId,
                senderName: name,
                receverId: receverId,
                message: text
            })
            const data = await partnerCustomerModel.findOne({ myId: senderId })
            if (data) {
                let myFriends = data.myFriends
                let index = myFriends.findIndex(f => f.fdId === receverId)
                while (index > 0) {
                    let temp = myFriends[index]
                    myFriends[index] = myFriends[index - 1]
                    myFriends[index - 1] = temp
                    index--
                }
                await partnerCustomerModel.updateOne(
                    {
                        myId: senderId
                    },
                    {
                        myFriends
                    }
                )
            }
            const data1 = await partnerCustomerModel.findOne({ myId: receverId })
            if (data1) {
                let myFriends1 = data1.myFriends
                let index1 = myFriends1.findIndex(f => f.fdId === senderId)
                while (index1 > 0) {
                    let temp1 = myFriends1[index1]
                    myFriends1[index1] = myFriends1[index1 - 1]
                    myFriends1[index1 - 1] = temp1
                    index1--
                }
                await partnerCustomerModel.updateOne(
                    {
                        myId: receverId
                    },
                    {
                        myFriends: myFriends1
                    }
                )
            }
            responseReturn(res, 201, { message })
        } catch (error) {
            console.log(error)
        }
    }
    // End Method 

    get_partners = async (req, res) => {
        try {
            const partners = await partnerModel.find({}).select('shopInfo image status name');
            const scrubbed = partners.map(s => ({
                _id: s._id,
                shopName: s.shopInfo?.shopName || s.name,
                image: s.image,
                status: s.status
            }));
            responseReturn(res, 200, {
                admins: scrubbed,
                partners: scrubbed
            })
        } catch (error) {
            console.log(error)
        }
    }
    // End Method 

    partner_admin_message_insert = async (req, res) => {
        const { senderId, receverId, message, senderName } = req.body
        try {
            const messageData = await adminPartnerMessage.create({
                senderId,
                receverId,
                message,
                senderName
            })
            responseReturn(res, 200, { message: messageData })
        } catch (error) {
            console.log(error)
        }
    }
    // End Method 

    get_admin_messages = async (req, res) => {
        const { receverId } = req.params
        const id = ""
        try {
            const messages = await adminPartnerMessage.find({
                $or: [
                    {
                        $and: [{
                            receverId: { $eq: receverId }
                        }, {
                            senderId: {
                                $eq: id
                            }
                        }]
                    },
                    {
                        $and: [{
                            receverId: { $eq: id }
                        }, {
                            senderId: {
                                $eq: receverId
                            }
                        }]
                    }
                ]
            })
            let currentPartner = {}
            if (receverId) {
                const partner = await partnerModel.findById(receverId).select('shopInfo image name');
                currentPartner = partner ? {
                    _id: partner._id,
                    shopName: partner.shopInfo?.shopName || partner.name,
                    image: partner.image
                } : {};
            }
            responseReturn(res, 200, {
                messages,
                currentAdminUser: currentPartner,
                currentPartner: currentPartner
            })

        } catch (error) {
            console.log(error)
        }
    }
    // End Method 

    get_partner_messages = async (req, res) => {
        const receverId = ""
        const { id } = req
        try {
            const messages = await adminPartnerMessage.find({
                $or: [
                    {
                        $and: [{
                            receverId: { $eq: receverId }
                        }, {
                            senderId: {
                                $eq: id
                            }
                        }]
                    },
                    {
                        $and: [{
                            receverId: { $eq: id }
                        }, {
                            senderId: {
                                $eq: receverId
                            }
                        }]
                    }
                ]
            })

            responseReturn(res, 200, {
                messages
            })

        } catch (error) {
            console.log(error)
        }
    }
    // End Method  

    insert_hire_support_message = async (req, res) => {
        const { senderId, message, senderName } = req.body;
        const receverId = "";
        try {
            const messageData = await adminPartnerMessage.create({
                senderId,
                receverId,
                message,
                senderName
            });
            responseReturn(res, 200, { message: messageData });
        } catch (error) {
            console.log('Hire Support Msg Error:', error);
            responseReturn(res, 500, { error: error.message });
        }
    }

    get_hire_support_messages = async (req, res) => {
        const { id } = req;
        const receverId = "";
        try {
            const messages = await adminPartnerMessage.find({
                $or: [
                    {
                        $and: [
                            { receverId: { $eq: receverId } },
                            { senderId: { $eq: id } }
                        ]
                    },
                    {
                        $and: [
                            { receverId: { $eq: id } },
                            { senderId: { $eq: receverId } }
                        ]
                    }
                ]
            }).sort({ createdAt: 1 });

            responseReturn(res, 200, { messages });
        } catch (error) {
            console.log(error);
            responseReturn(res, 500, { error: error.message });
        }
    }
}

module.exports = new ChatController()
