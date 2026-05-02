var express = require('express');
var router = express.Router();
var db = require('./db');

/* GET users listing. */
router.get('/', function(req, res, next) {
  res.send('respond with a resource');
});

router.get('/:table_name', async (req, res) => {
  const { table_name } = req.params;

  try {

    if (!table_name) {
      return res.json({
        success: false,
        message: 'Table name is required',
        error: null
      });
    }

    const query = `SELECT * FROM ${table_name}`;

    const result = await db.request().query(query);

    return res.json({
      success: true,
      message: 'Data fetched successfully',
      data: result.recordset
    });

  } catch (error) {
    return res.json({
      success: false,
      message: 'Error fetching data',
      error: error.message
    });
  }
});



const student = {
  id: 1,
  name: 'Demo Student',
  email: 'student@example.com',
  password: 'password123',
}

router.post('/login/student/', (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({
      message: 'Email and password are required',
    })
  }

  if (email !== student.email || password !== student.password) {
    return res.status(401).json({
      message: 'Invalid student credentials',
    })
  }

  return res.json({
    message: 'Student login successful',
    role: 'student',
    user: {
      id: student.id,
      name: student.name,
      email: student.email,
    },
  })
})



module.exports = router;
