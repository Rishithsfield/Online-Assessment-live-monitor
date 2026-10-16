import QuestionTemplate from '../models/QuestionTemplate.js';

export async function getTemplates(req, res) {
  try {
    const filter = {};
    if (req.query.difficulty) filter.difficulty = req.query.difficulty;
    if (req.query.tag) filter.tags = { $in: [req.query.tag] };
    const templates = await QuestionTemplate.find(filter).sort({ createdAt: -1 });
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch templates: ' + err.message });
  }
}

export async function createTemplate(req, res) {
  try {
    const template = await QuestionTemplate.create(req.body);
    res.status(201).json(template);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create template: ' + err.message });
  }
}

export async function deleteTemplate(req, res) {
  try {
    await QuestionTemplate.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete template: ' + err.message });
  }
}
