const cloudinary = require('../../utiles/cloudinary')
const formidable = require('formidable')
const { responseReturn } = require('../../utiles/response')
const SuccessStoryModel = require('../../models/Awareness/successStoryModel') // make sure schema exists

class SuccessStoryController {

    // Create Success Story
    add_story = async (req, res) => {
        const form = formidable({ multiples: false });
        form.parse(req, async (err, fields, files) => {
            if (err) return responseReturn(res, 500, { error: err.message });

            const getValue = (field) => Array.isArray(field) ? field[0] : field;
            const heading = getValue(fields.heading);
            const description = getValue(fields.description);
            const name = getValue(fields.name);
            const area = getValue(fields.area);
            const experience = getValue(fields.experience);
            const image = files.image;

            if (!heading || !description || !name || !area || !experience || !image) {
                return responseReturn(res, 400, { error: 'All fields are required' });
            }

            try {
                const slug = heading.trim().toLowerCase().replace(/\s+/g, '-');
                const result = await cloudinary.uploader.upload(image.filepath, { folder: 'SuccessStory' });

                const story = await SuccessStoryModel.create({
                    heading,
                    slug,
                    description,
                    name,
                    area,
                    experience,
                    image: result.secure_url,
                    isActive: true // default active
                });

                return responseReturn(res, 201, { story, message: 'Success Story created successfully' });
            } catch (error) {
                return responseReturn(res, 500, { error: error.message });
            }
        });
    }

    // Get all stories
    get_stories = async (req, res) => {
        try {
            let stories = await SuccessStoryModel.find().sort({ createdAt: -1 })
            stories = stories.map(s => {
                const storyObj = s.toObject()
                if (storyObj.image && storyObj.image.includes("http://")) {
                    storyObj.image = storyObj.image.replace("http://", "https://")
                }
                return storyObj
            })
            return responseReturn(res, 200, { stories })
        } catch (error) {
            return responseReturn(res, 500, { error: error.message })
        }
    }

    // Get single story
    get_story = async (req, res) => {
        try {
            let story = await SuccessStoryModel.findById(req.params.id)
            if (!story) return responseReturn(res, 404, { error: 'Story not found' })

            story = story.toObject()
            if (story.image && story.image.includes("http://")) {
                story.image = story.image.replace("http://", "https://")
            }
            return responseReturn(res, 200, { story })
        } catch (error) {
            return responseReturn(res, 500, { error: error.message })
        }
    }

    // Update story
    update_story = async (req, res) => {
        const form = formidable({ multiples: false })
        form.parse(req, async (err, fields, files) => {
            if (err) return responseReturn(res, 500, { error: 'Something went wrong' })

            const { heading, description, name, area, experience } = fields
            const { image } = files

            try {
                const story = await SuccessStoryModel.findById(req.params.id)
                if (!story) return responseReturn(res, 404, { error: 'Story not found' })

                if (heading) {
                    story.heading = heading
                    story.slug = heading.split(' ').join('-')
                }
                if (description) story.description = description
                if (name) story.name = name
                if (area) story.area = area
                if (experience) story.experience = experience

                if (image) {
                    const result = await cloudinary.uploader.upload(image.filepath, { folder: 'SuccessStory' })
                    story.image = result.secure_url
                }

                await story.save()
                return responseReturn(res, 200, { story, message: 'Success Story updated successfully' })
            } catch (error) {
                return responseReturn(res, 500, { error: error.message })
            }
        })
    }

    // Delete story
    delete_story = async (req, res) => {
        try {
            const story = await SuccessStoryModel.findByIdAndDelete(req.params.id)
            if (!story) return responseReturn(res, 404, { error: 'Story not found' })
            return responseReturn(res, 200, { message: 'Success Story deleted successfully' })
        } catch (error) {
            return responseReturn(res, 500, { error: error.message })
        }
    }

    // Toggle isActive status
    toggle_status = async (req, res) => {
        try {
            const story = await SuccessStoryModel.findById(req.params.id)
            if (!story) return responseReturn(res, 404, { error: 'Story not found' })

            story.isActive = !story.isActive
            await story.save()

            return responseReturn(res, 200, { story, message: `Success Story ${story.isActive ? 'activated' : 'deactivated'} successfully` })
        } catch (error) {
            return responseReturn(res, 500, { error: error.message })
        }
    }
}

module.exports = new SuccessStoryController()
