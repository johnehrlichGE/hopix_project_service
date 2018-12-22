const fs = require('fs');
const path = require('path');

const { validationResult } = require('express-validator/check');

const io = require('../socket');
const Project = require('../models/project');
const User = require('../models/user');

exports.getProjects = async (req, res, next) => {
  const currentPage = req.query.page || 1;
  const perPage = 5;
  try {
    const totalItems = await Project.find().countDocuments();
    const projects = await Project.find()
      .populate('creator')
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * perPage)
      .limit(perPage);

    res.status(200).json({
      message: 'Fetched projects successfully.',
      projects: projects,
      totalItems: totalItems
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.createProject = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error('Validation failed, entered data is incorrect.');
    error.statusCode = 422;
    throw error;
  }
  if (!req.file) {
    const error = new Error('No image provided.');
    error.statusCode = 422;
    throw error;
  }
  const imageUrl = req.file.path;
  const projectname = req.body.projectname;
  const content = req.body.content;
  const project = new Project({
    projectname: projectname,
    content: content,
    imageUrl: imageUrl,
    creator: req.userId
  });
  try {
    await project.save();
    const user = await User.findById(req.userId);
    user.projects.push(project);
    await user.save();
    io.getIO().emit('projects', {
      action: 'create',
      project: { ...project._doc, creator: { _id: req.userId, name: user.name } }
    });
    res.status(201).json({
      message: 'Project created successfully!',
      project: project,
      creator: { _id: user._id, name: user.name }
    });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.getProject = async (req, res, next) => {
  const projectId = req.params.projectId;
  const project = await Project.findById(projectId);
  try {
    if (!project) {
      const error = new Error('Could not find project.');
      error.statusCode = 404;
      throw error;
    }
    res.status(200).json({ message: 'Project fetched.', project: project });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.updateProject = async (req, res, next) => {
  const projectId = req.params.projectId;
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error('Validation failed, entered data is incorrect.');
    error.statusCode = 422;
    throw error;
  }
  const projectname = req.body.projectname;
  const content = req.body.content;
  let imageUrl = req.body.image;
  if (req.file) {
    imageUrl = req.file.path;
  }
  if (!imageUrl) {
    const error = new Error('No file picked.');
    error.statusCode = 422;
    throw error;
  }
  try {
    const project = await Project.findById(projectId).populate('creator');
    if (!project) {
      const error = new Error('Could not find project.');
      error.statusCode = 404;
      throw error;
    }
    if (project.creator._id.toString() !== req.userId) {
      const error = new Error('Not authorized!');
      error.statusCode = 403;
      throw error;
    }
    if (imageUrl !== project.imageUrl) {
      clearImage(project.imageUrl);
    }
    project.projectname = projectname;
    project.imageUrl = imageUrl;
    project.content = content;
    const result = await project.save();
    io.getIO().emit('projects', { action: 'update', project: result });
    res.status(200).json({ message: 'Project updated!', project: result });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

exports.deleteProject = async (req, res, next) => {
  const projectId = req.params.projectId;
  try {
    const project = await Project.findById(projectId);

    if (!project) {
      const error = new Error('Could not find project.');
      error.statusCode = 404;
      throw error;
    }
    if (project.creator.toString() !== req.userId) {
      const error = new Error('Not authorized!');
      error.statusCode = 403;
      throw error;
    }
    // Check logged in user
    clearImage(project.imageUrl);
    await Project.findByIdAndRemove(projectId);

    const user = await User.findById(req.userId);
    user.projects.pull(projectId);
    await user.save();
    io.getIO().emit('projects', { action: 'delete', project: projectId });
    res.status(200).json({ message: 'Deleted project.' });
  } catch (err) {
    if (!err.statusCode) {
      err.statusCode = 500;
    }
    next(err);
  }
};

const clearImage = filePath => {
  filePath = path.join(__dirname, '..', filePath);
  fs.unlink(filePath, err => console.log(err));
};
