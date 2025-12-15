const express = require("express");
const router = express.Router();
const resumeEditorCOntroller = require("../../controllers/hire/resumeEditorController");

router.post("/editors", resumeEditorCOntroller.createEditor);

router.get("/editors", resumeEditorCOntroller.getAllEditors);

router.get("/editors/:id", resumeEditorCOntroller.getEditorById);

router.put("/editors/:id", resumeEditorCOntroller.updateEditor);

router.delete("/editors/:id", resumeEditorCOntroller.deleteEditor);

module.exports = router;
