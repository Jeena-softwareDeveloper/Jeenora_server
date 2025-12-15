const Contact = require('../models/Contact');
const csv = require('csv-parser');
const stream = require('stream');

class ContactController {
  
  // Create contact
  async createContact(req, res) {
    try {
      const contact = new Contact(req.body);
      await contact.save();

      res.status(201).json({
        success: true,
        data: contact,
        message: 'Contact created successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // Bulk import contacts
  async importContacts(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'CSV file is required'
        });
      }

      const contacts = [];
      const errors = [];
      let processed = 0;

      const bufferStream = new stream.PassThrough();
      bufferStream.end(req.file.buffer);

      await new Promise((resolve, reject) => {
        bufferStream
          .pipe(csv())
          .on('data', (row) => {
            processed++;
            try {
              const contact = this.parseContactFromRow(row);
              if (contact) {
                contacts.push(contact);
              }
            } catch (error) {
              errors.push({ row: processed, error: error.message });
            }
          })
          .on('end', resolve)
          .on('error', reject);
      });

      // Insert all contacts
      const result = await Contact.insertMany(contacts, { ordered: false });

      res.json({
        success: true,
        data: {
          imported: result.length,
          errors: errors,
          totalProcessed: processed
        },
        message: 'Contacts imported successfully'
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  parseContactFromRow(row) {
    if (!row.phone) {
      throw new Error('Phone number is required');
    }

    return {
      phone: row.phone,
      email: row.email,
      name: {
        firstName: row.firstName || row.first_name,
        lastName: row.lastName || row.last_name
      },
      segments: row.segments ? row.segments.split(',').map(s => s.trim()) : [],
      preferences: {
        whatsapp: row.whatsapp !== 'false',
        email: row.email !== 'false'
      },
      tags: row.tags ? row.tags.split(',').map(t => t.trim()) : []
    };
  }

  // Get contacts with filtering and pagination
  async getContacts(req, res) {
    try {
      const {
        page = 1,
        limit = 50,
        segment,
        search,
        hasEmail,
        hasWhatsapp
      } = req.query;

      const filter = { isActive: true };
      
      if (segment) filter.segments = segment;
      if (search) {
        filter.$or = [
          { 'name.firstName': { $regex: search, $options: 'i' } },
          { 'name.lastName': { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ];
      }
      if (hasEmail === 'true') filter.email = { $exists: true, $ne: '' };
      if (hasWhatsapp === 'true') filter['optInStatus.whatsapp'] = true;

      const contacts = await Contact.find(filter)
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

      const total = await Contact.countDocuments(filter);

      res.json({
        success: true,
        data: contacts,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Update contact
  async updateContact(req, res) {
    try {
      const contact = await Contact.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
      );

      if (!contact) {
        return res.status(404).json({
          success: false,
          message: 'Contact not found'
        });
      }

      res.json({
        success: true,
        data: contact,
        message: 'Contact updated successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // Delete contact (soft delete)
  async deleteContact(req, res) {
    try {
      const contact = await Contact.findByIdAndUpdate(
        req.params.id,
        { isActive: false },
        { new: true }
      );

      if (!contact) {
        return res.status(404).json({
          success: false,
          message: 'Contact not found'
        });
      }

      res.json({
        success: true,
        message: 'Contact deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get contact segments
  async getSegments(req, res) {
    try {
      const segments = await Contact.distinct('segments', { isActive: true });
      
      res.json({
        success: true,
        data: segments.filter(segment => segment && segment.trim() !== '')
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new ContactController();