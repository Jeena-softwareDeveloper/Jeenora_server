const cloudinary = require('../../utiles/cloudinary');
const formidable = require('formidable');
const { responseReturn } = require('../../utiles/response');
const OrganicVideo = require('../../models/Awareness/videoModel');

class VideoController {

  // -------------------- Create Video -------------------- //
  add_video = async (req, res) => {
    const form = formidable({ multiples: false, keepExtensions: true });

    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error(err);
        return responseReturn(res, 500, { error: 'Something went wrong while parsing the form' });
      }

      const { heading, secondaryHeading, views, author } = fields;
      const { video } = files;

      // Validation
      if (!heading?.trim() || !author?.trim() || !video?.filepath) {
        return responseReturn(res, 400, { error: 'Heading, video, and author are required' });
      }

      try {
        // Upload video to Cloudinary
        const result = await cloudinary.uploader.upload(video.filepath, {
          resource_type: 'video',
          folder: 'OrganicVideos'
        });

        const organicVideo = await OrganicVideo.create({
          heading: heading.trim(),
          secondaryHeading: secondaryHeading?.trim() || '',
          video: result.secure_url,
          views: views ? Number(views) : 0,
          author: author.trim(),
          isActive: true
        });

        return responseReturn(res, 201, { organicVideo, message: 'Video created successfully' });

      } catch (error) {
        console.error(error);
        return responseReturn(res, 500, { error: error.message });
      }
    });
  }

  // -------------------- Get All Videos -------------------- //
  get_videos = async (req, res) => {
    try {
      let videos = await OrganicVideo.find().sort({ createdAt: -1 });
      videos = videos.map(v => {
        const videoObj = v.toObject();
        if (videoObj.video && videoObj.video.includes("http://")) {
          videoObj.video = videoObj.video.replace("http://", "https://");
        }
        return videoObj;
      });
      return responseReturn(res, 200, { videos });
    } catch (error) {
      console.error(error);
      return responseReturn(res, 500, { error: error.message });
    }
  }

  // -------------------- Get Single Video -------------------- //
  get_video = async (req, res) => {
    try {
      let video = await OrganicVideo.findById(req.params.id);
      if (!video) return responseReturn(res, 404, { error: 'Video not found' });

      video = video.toObject();
      if (video.video && video.video.includes("http://")) {
        video.video = video.video.replace("http://", "https://");
      }
      return responseReturn(res, 200, { video });
    } catch (error) {
      console.error(error);
      return responseReturn(res, 500, { error: error.message });
    }
  }

  // -------------------- Update Video -------------------- //
  update_video = async (req, res) => {
    const form = formidable({ multiples: false, keepExtensions: true });

    form.parse(req, async (err, fields, files) => {
      if (err) {
        console.error(err);
        return responseReturn(res, 500, { error: 'Something went wrong while parsing the form' });
      }

      const { heading, secondaryHeading, views, author, isActive } = fields;
      const { video } = files;

      try {
        const organicVideo = await OrganicVideo.findById(req.params.id);
        if (!organicVideo) return responseReturn(res, 404, { error: 'Video not found' });

        // Update fields if provided
        if (heading?.trim()) organicVideo.heading = heading.trim();
        if (secondaryHeading?.trim()) organicVideo.secondaryHeading = secondaryHeading.trim();
        if (views) organicVideo.views = Number(views);
        if (author?.trim()) organicVideo.author = author.trim();
        if (typeof isActive !== 'undefined') organicVideo.isActive = isActive === 'true';

        // Upload new video if provided
        if (video?.filepath) {
          const result = await cloudinary.uploader.upload(video.filepath, {
            resource_type: 'video',
            folder: 'OrganicVideos'
          });
          organicVideo.video = result.secure_url;
        }

        await organicVideo.save();
        return responseReturn(res, 200, { organicVideo, message: 'Video updated successfully' });

      } catch (error) {
        console.error(error);
        return responseReturn(res, 500, { error: error.message });
      }
    });
  }

  // -------------------- Delete Video -------------------- //
  delete_video = async (req, res) => {
    try {
      const video = await OrganicVideo.findByIdAndDelete(req.params.id);
      if (!video) return responseReturn(res, 404, { error: 'Video not found' });
      return responseReturn(res, 200, { message: 'Video deleted successfully' });
    } catch (error) {
      console.error(error);
      return responseReturn(res, 500, { error: error.message });
    }
  }

  // -------------------- Toggle Active/Inactive Status -------------------- //
  toggle_status = async (req, res) => {
    try {
      const video = await OrganicVideo.findById(req.params.id);
      if (!video) return responseReturn(res, 404, { error: 'Video not found' });

      video.isActive = !video.isActive;
      await video.save();

      return responseReturn(res, 200, { video, message: `Video is now ${video.isActive ? 'active' : 'inactive'}` });
    } catch (error) {
      console.error(error);
      return responseReturn(res, 500, { error: error.message });
    }
  }
}

module.exports = new VideoController();
