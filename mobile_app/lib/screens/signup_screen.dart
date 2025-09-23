import 'package:flutter/material.dart';
import '../services/api_client.dart';

class SignupScreen extends StatefulWidget {
  final VoidCallback onSignupSuccess;
  const SignupScreen({super.key, required this.onSignupSuccess});

  @override
  State<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends State<SignupScreen> {
  final _formKey = GlobalKey<FormState>();
  final _pageController = PageController();
  int _currentPage = 0;
  bool _loading = false;
  String? _error;

  // Form controllers
  final _regController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _courseController = TextEditingController();
  final _branchController = TextEditingController();
  final _sectionController = TextEditingController();
  final _yearController = TextEditingController();
  final _semesterController = TextEditingController();
  final _academicYearController = TextEditingController();
  
  String _languagePreference = 'en';

  @override
  void dispose() {
    _regController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _nameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _courseController.dispose();
    _branchController.dispose();
    _sectionController.dispose();
    _yearController.dispose();
    _semesterController.dispose();
    _academicYearController.dispose();
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_passwordController.text != _confirmPasswordController.text) {
      setState(() => _error = 'Passwords do not match');
      return;
    }

    setState(() { _loading = true; _error = null; });
    try {
      await ApiClient.instance.signup(
        registrationNumber: _regController.text.trim(),
        password: _passwordController.text,
        name: _nameController.text.trim(),
        email: _emailController.text.trim().isEmpty ? null : _emailController.text.trim(),
        phoneNumber: _phoneController.text.trim().isEmpty ? null : _phoneController.text.trim(),
        course: _courseController.text.trim().isEmpty ? null : _courseController.text.trim(),
        branch: _branchController.text.trim().isEmpty ? null : _branchController.text.trim(),
        section: _sectionController.text.trim().isEmpty ? null : _sectionController.text.trim(),
        year: _yearController.text.trim().isEmpty ? null : _yearController.text.trim(),
        semester: _semesterController.text.trim().isEmpty ? null : _semesterController.text.trim(),
        academicYear: _academicYearController.text.trim().isEmpty ? null : _academicYearController.text.trim(),
        languagePreference: _languagePreference,
      );
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Account created successfully! Please login to continue.'),
            backgroundColor: Colors.green,
          ),
        );
        widget.onSignupSuccess();
      }
    } catch (e) {
      setState(() { _error = e.toString(); });
    } finally {
      if (mounted) setState(() { _loading = false; });
    }
  }

  void _nextPage() {
    if (_currentPage < 2) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    }
  }

  void _previousPage() {
    if (_currentPage > 0) {
      _pageController.previousPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Create Account'),
        backgroundColor: Colors.indigo.shade50,
        elevation: 0,
      ),
      body: Form(
        key: _formKey,
        child: Column(
          children: [
            // Progress indicator
            Container(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  for (int i = 0; i < 3; i++)
                    Expanded(
                      child: Container(
                        height: 4,
                        margin: EdgeInsets.only(right: i < 2 ? 8 : 0),
                        decoration: BoxDecoration(
                          color: i <= _currentPage ? Colors.indigo : Colors.grey.shade300,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            
            // Error message
            if (_error != null)
              Container(
                margin: const EdgeInsets.all(16),
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

            // Page view
            Expanded(
              child: PageView(
                controller: _pageController,
                onPageChanged: (index) => setState(() => _currentPage = index),
                children: [
                  _buildBasicInfoPage(),
                  _buildContactInfoPage(),
                  _buildAcademicInfoPage(),
                ],
              ),
            ),

            // Navigation buttons
            Container(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  if (_currentPage > 0)
                    Expanded(
                      child: OutlinedButton(
                        onPressed: _loading ? null : _previousPage,
                        child: const Text('Previous'),
                      ),
                    ),
                  if (_currentPage > 0) const SizedBox(width: 16),
                  Expanded(
                    child: FilledButton(
                      onPressed: _loading ? null : (_currentPage < 2 ? _nextPage : _submit),
                      child: _loading
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : Text(_currentPage < 2 ? 'Next' : 'Create Account'),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBasicInfoPage() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Basic Information',
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          const Text(
            'Let\'s start with your basic details',
            style: TextStyle(color: Colors.grey),
          ),
          const SizedBox(height: 24),
          
          TextFormField(
            controller: _regController,
            decoration: const InputDecoration(
              labelText: 'Registration Number *',
              border: OutlineInputBorder(),
              prefixIcon: Icon(Icons.badge),
            ),
            validator: (v) => (v?.trim().isEmpty ?? true) ? 'Registration number is required' : null,
          ),
          const SizedBox(height: 16),
          
          TextFormField(
            controller: _nameController,
            decoration: const InputDecoration(
              labelText: 'Full Name *',
              border: OutlineInputBorder(),
              prefixIcon: Icon(Icons.person),
            ),
            validator: (v) => (v?.trim().isEmpty ?? true) ? 'Name is required' : null,
          ),
          const SizedBox(height: 16),
          
          TextFormField(
            controller: _passwordController,
            decoration: const InputDecoration(
              labelText: 'Password *',
              border: OutlineInputBorder(),
              prefixIcon: Icon(Icons.lock),
            ),
            obscureText: true,
            validator: (v) => (v?.isEmpty ?? true) ? 'Password is required' : 
                              (v!.length < 6 ? 'Password must be at least 6 characters' : null),
          ),
          const SizedBox(height: 16),
          
          TextFormField(
            controller: _confirmPasswordController,
            decoration: const InputDecoration(
              labelText: 'Confirm Password *',
              border: OutlineInputBorder(),
              prefixIcon: Icon(Icons.lock_outline),
            ),
            obscureText: true,
            validator: (v) => (v?.isEmpty ?? true) ? 'Please confirm your password' : null,
          ),
        ],
      ),
    );
  }

  Widget _buildContactInfoPage() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Contact Information',
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          const Text(
            'How can we reach you?',
            style: TextStyle(color: Colors.grey),
          ),
          const SizedBox(height: 24),
          
          TextFormField(
            controller: _emailController,
            decoration: const InputDecoration(
              labelText: 'Email Address',
              border: OutlineInputBorder(),
              prefixIcon: Icon(Icons.email),
            ),
            keyboardType: TextInputType.emailAddress,
          ),
          const SizedBox(height: 16),
          
          TextFormField(
            controller: _phoneController,
            decoration: const InputDecoration(
              labelText: 'Phone Number',
              border: OutlineInputBorder(),
              prefixIcon: Icon(Icons.phone),
            ),
            keyboardType: TextInputType.phone,
          ),
          const SizedBox(height: 16),
          
          DropdownButtonFormField<String>(
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
        ],
      ),
    );
  }

  Widget _buildAcademicInfoPage() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Academic Information',
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          const Text(
            'Tell us about your academic details',
            style: TextStyle(color: Colors.grey),
          ),
          const SizedBox(height: 24),
          
          TextFormField(
            controller: _courseController,
            decoration: const InputDecoration(
              labelText: 'Course (e.g., B.Tech)',
              border: OutlineInputBorder(),
              prefixIcon: Icon(Icons.school),
            ),
          ),
          const SizedBox(height: 16),
          
          TextFormField(
            controller: _branchController,
            decoration: const InputDecoration(
              labelText: 'Branch (e.g., Computer Science)',
              border: OutlineInputBorder(),
              prefixIcon: Icon(Icons.code),
            ),
          ),
          const SizedBox(height: 16),
          
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  controller: _sectionController,
                  decoration: const InputDecoration(
                    labelText: 'Section',
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.group),
                  ),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: TextFormField(
                  controller: _yearController,
                  decoration: const InputDecoration(
                    labelText: 'Year',
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.calendar_today),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  controller: _semesterController,
                  decoration: const InputDecoration(
                    labelText: 'Semester',
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.timeline),
                  ),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: TextFormField(
                  controller: _academicYearController,
                  decoration: const InputDecoration(
                    labelText: 'Academic Year',
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.date_range),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
