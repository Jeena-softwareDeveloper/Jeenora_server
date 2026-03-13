const Editor = require("../../models/hire/resumeEditor");

// Create a new editor
exports.createEditor = async (req, res) => {
  try {
    const editor = new Editor(req.body);
    await editor.save();
    res.status(201).json(editor);
  } catch (error) {
    res.status(400).json({ message: "Error creating editor", error });
  }
};

// Get all editors
exports.getAllEditors = async (req, res) => {
  try {
    const editors = await Editor.find();
    res.status(200).json(editors);
  } catch (error) {
    res.status(500).json({ message: "Error fetching editors", error });
  }
};

// Get editor by ID
exports.getEditorById = async (req, res) => {
  try {
    const editor = await Editor.findById(req.params.id);
    if (!editor) {
      return res.status(404).json({ message: "Editor not found" });
    }
    res.status(200).json(editor);
  } catch (error) {
    res.status(500).json({ message: "Error fetching editor", error });
  }
};

// Update an editor by ID
exports.updateEditor = async (req, res) => {
  try {
    const editor = await Editor.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!editor) {
      return res.status(404).json({ message: "Editor not found" });
    }
    res.status(200).json(editor);
  } catch (error) {
    res.status(400).json({ message: "Error updating editor", error });
  }
};

// Delete an editor by ID
exports.deleteEditor = async (req, res) => {
  try {
    const editor = await Editor.findByIdAndDelete(req.params.id);
    if (!editor) {
      return res.status(404).json({ message: "Editor not found" });
    }
    res.status(200).json({ message: "Editor deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting editor", error });
  }
};
