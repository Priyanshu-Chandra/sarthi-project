export const isInstructor = (req, res, next) => {
  if (!req.user || req.user.role !== 'instructor') {
    return res.status(403).json({ error: 'Forbidden: instructor only' });
  }
  next();
};

export const isStudent = (req, res, next) => {
  if (!req.user || req.user.role !== 'student') {
    return res.status(403).json({ error: 'Forbidden: student only' });
  }
  next();
};
