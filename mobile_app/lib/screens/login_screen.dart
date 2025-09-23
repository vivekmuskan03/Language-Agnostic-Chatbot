import 'package:flutter/material.dart';
import '../services/api_client.dart';
import '../widgets/api_base_url_dialog.dart';
import 'signup_screen.dart';

class LoginScreen extends StatefulWidget {
  final void Function(String token) onLoggedIn;
  const LoginScreen({super.key, required this.onLoggedIn});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _regController = TextEditingController();
  final _passController = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _regController.dispose();
    _passController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _loading = true; _error = null; });
    try {
      final result = await ApiClient.instance.login(
        registrationNumber: _regController.text.trim(),
        password: _passController.text,
      );
      final token = result['token'] as String;
      widget.onLoggedIn(token);
    } catch (e) {
      setState(() { _error = e.toString(); });
    } finally {
      if (mounted) setState(() { _loading = false; });
    }
  }

  Future<void> _openServerSettings() async {
    await showDialog(context: context, builder: (_) => const ApiBaseUrlDialog());
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('API set to: ${ApiClient.instance.baseUrl}')),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Icon(Icons.chat_bubble_outline, size: 72, color: Colors.indigo),
                const SizedBox(height: 8),
                TextButton.icon(
                  onPressed: _openServerSettings,
                  icon: const Icon(Icons.settings, size: 16),
                  label: const Text('Server settings'),
                ),
                const SizedBox(height: 8),
                const Text('Chatbot Login', textAlign: TextAlign.center, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w600)),
                const SizedBox(height: 16),
                if (_error != null)
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(8)),
                    child: Text(_error!, style: const TextStyle(color: Colors.red)),
                  ),
                const SizedBox(height: 12),
                Form(
                  key: _formKey,
                  child: Column(children: [
                    TextFormField(
                      controller: _regController,
                      decoration: const InputDecoration(labelText: 'Registration Number', border: OutlineInputBorder()),
                      keyboardType: TextInputType.text,
                      validator: (v) => (v==null || v.trim().isEmpty) ? 'Enter registration number' : null,
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: _passController,
                      decoration: const InputDecoration(labelText: 'Password', border: OutlineInputBorder()),
                      obscureText: true,
                      validator: (v) => (v==null || v.isEmpty) ? 'Enter password' : null,
                    ),
                    const SizedBox(height: 20),
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: FilledButton(
                        onPressed: _loading ? null : _submit,
                        child: _loading
                            ? const SizedBox(height: 22, width: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                            : const Text('Login'),
                      ),
                    ),
                  ]),
                ),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text('Don\'t have an account? '),
                    TextButton(
                      onPressed: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (context) => SignupScreen(
                              onSignupSuccess: () => Navigator.of(context).pop(),
                            ),
                          ),
                        );
                      },
                      child: const Text('Sign up'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

