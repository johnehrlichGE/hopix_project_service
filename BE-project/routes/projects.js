const express = require('express');
const { body } = require('express-validator/check');

const projectsController = require('../controllers/projects');
const isAuth = require('../middleware/is-auth');

const router = express.Router();

// GET /projects/posts
router.get('/projects', isAuth, projectsController.getProjects);

// POST /projects/post
router.post(
  '/project',
  isAuth,
  [
    body('projectname')
      .trim()
      .isLength({ min: 5 }),
    body('content')
      .trim()
      .isLength({ min: 5 })
  ],
  projectsController.createProject
);

router.get('/project/:projectId', isAuth, projectsController.getProject);

router.put(
  '/project/:projectId',
  isAuth,
  [
    body('projectname')
      .trim()
      .isLength({ min: 5 }),
    body('content')
      .trim()
      .isLength({ min: 5 })
  ],
  projectsController.updateProject
);

router.delete('/project/:projectId', isAuth, projectsController.deleteProject);

module.exports = router;
