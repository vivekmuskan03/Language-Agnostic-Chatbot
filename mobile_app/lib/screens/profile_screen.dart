import 'package:flutter/material.dart';
import '../services/api_client.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  bool _isEditing = false;
  bool _loading = false;
  String? _error;
  Map<String, dynamic> _userProfile = {};

  // Form controllers
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _sectionController = TextEditingController();
  final _yearController = TextEditingController();
  final _semesterController = TextEditingController();
  final _academicYearController = TextEditingController();
  
  String _languagePreference = 'en';

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _sectionController.dispose();
    _yearController.dispose();
    _semesterController.dispose();
    _academicYearController.dispose();
    super.dispose();
  }

  Future<void> _loadProfile() async {
    setState(() => _loading = true);
    try {
      final profile = await ApiClient.instance.getUserProfile();
      setState(() {
        _userProfile = profile;
        _nameController.text = profile['name'] ?? '';
        _emailController.text = profile['email'] ?? '';
        _phoneController.text = profile['phoneNumber'] ?? '';
        _sectionController.text = profile['section'] ?? '';
        _yearController.text = profile['year'] ?? '';
        _semesterController.text = profile['semester'] ?? '';
        _academicYearController.text = profile['academicYear'] ?? '';
        _languagePreference = profile['languagePreference'] ?? 'en';
      });
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _saveProfile() async {
    if (!_formKey.currentState!.validate()) return;
    
    setState(() { _loading = true; _error = null; });
    try {
      await ApiClient.instance.updateProfile(
        name: _nameController.text.trim(),
        email: _emailController.text.trim().isEmpty ? null : _emailController.text.trim(),
        phoneNumber: _phoneController.text.trim().isEmpty ? null : _phoneController.text.trim(),
        section: _sectionController.text.trim().isEmpty ? null : _sectionController.text.trim(),
        year: _yearController.text.trim().isEmpty ? null : _yearController.text.trim(),
        semester: _semesterController.text.trim().isEmpty ? null : _semesterController.text.trim(),
        academicYear: _academicYearController.text.trim().isEmpty ? null : _academicYearController.text.trim(),
        languagePreference: _languagePreference,
      );
      
      setState(() => _isEditing = false);
      await _loadProfile(); // Reload to get updated data
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Profile updated successfully!'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      setState(() => _loading = false);
    }
  }

  void _cancelEdit() {
    setState(() {
      _isEditing = false;
      _error = null;
      // Reset form fields
      _nameController.text = _userProfile['name'] ?? '';
      _emailController.text = _userProfile['email'] ?? '';
      _phoneController.text = _userProfile['phoneNumber'] ?? '';
      _sectionController.text = _userProfile['section'] ?? '';
      _yearController.text = _userProfile['year'] ?? '';
      _semesterController.text = _userProfile['semester'] ?? '';
      _academicYearController.text = _userProfile['academicYear'] ?? '';
      _languagePreference = _userProfile['languagePreference'] ?? 'en';
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile'),
        backgroundColor: Colors.indigo.shade50,
        elevation: 0,
        actions: [
          if (!_isEditing)
            IconButton(
              onPressed: () => setState(() => _isEditing = true),
              icon: const Icon(Icons.edit),
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Profile header
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [Colors.indigo.shade400, Colors.indigo.shade600],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Column(
                        children: [
                          CircleAvatar(
                            radius: 40,
                            backgroundColor: Colors.white,
                            child: Text(
                              (_userProfile['name'] ?? 'U').substring(0, 1).toUpperCase(),
                              style: TextStyle(
                                fontSize: 32,
                                fontWeight: FontWeight.bold,
                                color: Colors.indigo.shade600,
                              ),
                            ),
                          ),
                          const SizedBox(height: 12),
                          Text(
                            _userProfile['name'] ?? 'User',
                            style: const TextStyle(
                              fontSize: 24,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                            ),
                          ),
                          Text(
                            _userProfile['registrationNumber'] ?? '',
                            style: const TextStyle(
                              fontSize: 16,
                              color: Colors.white70,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Error message
                    if (_error != null)
                      Container(
                        margin: const EdgeInsets.only(bottom: 16),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.red.shade50,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.red.shade200),
                        ),
                        child: Row(
                          children: [
                            Icon(Icons.error_outline, color: Colors.red.shade700, size: 20),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                _error!,
                                style: TextStyle(color: Colors.red.shade700),
                              ),
                            ),
                          ],
                        ),
                      ),

                    // Basic Information Section
                    _buildSection(
                      'Basic Information',
                      [
                        _buildInfoTile(
                          'Registration Number',
                          _userProfile['registrationNumber'] ?? '',
                          Icons.badge,
                          editable: false,
                        ),
                        _buildEditableField(
                          'Full Name',
                          _nameController,
                          Icons.person,
                          required: true,
                        ),
                        _buildInfoTile(
                          'Course',
                          _userProfile['course'] ?? 'Not specified',
                          Icons.school,
                          editable: false,
                        ),
                        _buildInfoTile(
                          'Branch',
                          _userProfile['branch'] ?? 'Not specified',
                          Icons.code,
                          editable: false,
                        ),
                      ],
                    ),

                    const SizedBox(height: 24),

                    // Contact Information Section
                    _buildSection(
                      'Contact Information',
                      [
                        _buildEditableField(
                          'Email Address',
                          _emailController,
                          Icons.email,
                          keyboardType: TextInputType.emailAddress,
                        ),
                        _buildEditableField(
                          'Phone Number',
                          _phoneController,
                          Icons.phone,
                          keyboardType: TextInputType.phone,
                        ),
                        _buildLanguageDropdown(),
                      ],
                    ),

                    const SizedBox(height: 24),

                    // Academic Information Section
                    _buildSection(
                      'Academic Information',
                      [
                        _buildEditableField(
                          'Section',
                          _sectionController,
                          Icons.group,
                        ),
                        _buildEditableField(
                          'Year',
                          _yearController,
                          Icons.calendar_today,
                        ),
                        _buildEditableField(
                          'Semester',
                          _semesterController,
                          Icons.timeline,
                        ),
                        _buildEditableField(
                          'Academic Year',
                          _academicYearController,
                          Icons.date_range,
                        ),
                      ],
                    ),

                    const SizedBox(height: 32),

                    // Action buttons
                    if (_isEditing)
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton(
                              onPressed: _loading ? null : _cancelEdit,
                              child: const Text('Cancel'),
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: FilledButton(
                              onPressed: _loading ? null : _saveProfile,
                              child: _loading
                                  ? const SizedBox(
                                      height: 20,
                                      width: 20,
                                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                    )
                                  : const Text('Save Changes'),
                            ),
                          ),
                        ],
                      ),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildSection(String title, List<Widget> children) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: Colors.indigo,
          ),
        ),
        const SizedBox(height: 12),
        ...children,
      ],
    );
  }

  Widget _buildInfoTile(String label, String value, IconData icon, {bool editable = true}) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.grey.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Row(
        children: [
          Icon(icon, color: Colors.indigo, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 12,
                    color: Colors.grey,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEditableField(
    String label,
    TextEditingController controller,
    IconData icon, {
    bool required = false,
    TextInputType? keyboardType,
  }) {
    if (!_isEditing) {
      return _buildInfoTile(label, controller.text.isEmpty ? 'Not specified' : controller.text, icon);
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      child: TextFormField(
        controller: controller,
        decoration: InputDecoration(
          labelText: required ? '$label *' : label,
          border: const OutlineInputBorder(),
          prefixIcon: Icon(icon),
        ),
        keyboardType: keyboardType,
        validator: required
            ? (v) => (v?.trim().isEmpty ?? true) ? '$label is required' : null
            : null,
      ),
    );
  }

  Widget _buildLanguageDropdown() {
    if (!_isEditing) {
      final languageNames = {'en': 'English', 'hi': 'Hindi', 'te': 'Telugu'};
      return _buildInfoTile(
        'Preferred Language',
        languageNames[_languagePreference] ?? 'English',
        Icons.language,
      );
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      child: DropdownButtonFormField<String>(
        initialValue: _languagePreference,
        decoration: const InputDecoration(
          labelText: 'Preferred Language',
          border: OutlineInputBorder(),
          prefixIcon: Icon(Icons.language),
        ),
        items: const [
          DropdownMenuItem(value: 'en', child: Text('English')),
          DropdownMenuItem(value: 'hi', child: Text('Hindi')),
          DropdownMenuItem(value: 'te', child: Text('Telugu')),
        ],
        onChanged: (value) => setState(() => _languagePreference = value ?? 'en'),
      ),
    );
  }
}
