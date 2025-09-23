import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiClient {
  ApiClient._();
  static final ApiClient instance = ApiClient._();

  // Default base URL; override at runtime with --dart-define=API_BASE_URL=...
  static final String _defaultBaseUrl = const String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.203.84.176:5000/api', // Production API endpoint
  );

  String baseUrl = _defaultBaseUrl;

  Future<Map<String, dynamic>> signup({
    required String registrationNumber,
    required String password,
    required String name,
    String? email,
    String? phoneNumber,
    String? course,
    String? branch,
    String? section,
    String? year,
    String? semester,
    String? academicYear,
    String? languagePreference,
  }) async {
    final uri = Uri.parse('$baseUrl/auth/signup');
    final body = {
      'registrationNumber': registrationNumber,
      'password': password,
      'name': name,
      if (email != null) 'email': email,
      if (phoneNumber != null) 'phoneNumber': phoneNumber,
      if (course != null) 'course': course,
      if (branch != null) 'branch': branch,
      if (section != null) 'section': section,
      if (year != null) 'year': year,
      if (semester != null) 'semester': semester,
      if (academicYear != null) 'academicYear': academicYear,
      if (languagePreference != null) 'languagePreference': languagePreference,
    };

    final res = await http.post(
      uri,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(body),
    );
    final data = _decode(res);
    if (res.statusCode == 200) {
      return data;
    }
    throw ApiError(message: data['error']?.toString() ?? 'Signup failed', status: res.statusCode);
  }

  Future<Map<String, dynamic>> login({
    required String registrationNumber,
    required String password,
  }) async {
    final uri = Uri.parse('$baseUrl/auth/login');
    final res = await http.post(
      uri,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'registrationNumber': registrationNumber,
        'password': password,
      }),
    );
    final data = _decode(res);
    if (res.statusCode == 200 && data['token'] is String) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('jwt', data['token']);
      await prefs.setString('user_info', jsonEncode(data['user'] ?? {}));
      return data;
    }
    throw ApiError(message: data['error']?.toString() ?? 'Login failed', status: res.statusCode);
  }

  Future<String> sendChat(String message, {String sessionId = 'default', String language = 'en'}) async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('jwt');
    if (token == null) throw ApiError(message: 'Not authenticated', status: 401);

    final uri = Uri.parse('$baseUrl/chat');
    final res = await http.post(
      uri,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode({'message': message, 'sessionId': sessionId, 'language': language}),
    );
    final data = _decode(res);
    if (res.statusCode == 200 && data['answer'] != null) {
      return data['answer'].toString();
    }
    if (res.statusCode == 401) {
      await prefs.remove('jwt');
    }
    throw ApiError(message: data['error']?.toString() ?? 'Chat failed', status: res.statusCode);
  }

  Future<List<Map<String, dynamic>>> getSessionHistory({String sessionId = 'default'}) async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('jwt');
    if (token == null) return [];
    final uri = Uri.parse('$baseUrl/chat/session');
    final res = await http.get(uri, headers: {'Authorization': 'Bearer $token'});
    final data = _decode(res);
    if (res.statusCode == 200) {
      final List<dynamic> hist = data['conversationHistory'] ?? [];
      return hist.cast<Map<String, dynamic>>();
    }
    return [];
  }

  // Preferences
  Future<Map<String, dynamic>> getPreferences() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('jwt');
    if (token == null) throw ApiError(message: 'Not authenticated', status: 401);
    final res = await http.get(Uri.parse('$baseUrl/user/preferences'), headers: {'Authorization': 'Bearer $token'});
    final data = _decode(res);
    if (res.statusCode == 200) return data;
    throw ApiError(message: data['error']?.toString() ?? 'Failed to load preferences', status: res.statusCode);
  }

  Future<void> updatePreferences(Map<String, dynamic> body) async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('jwt');
    if (token == null) throw ApiError(message: 'Not authenticated', status: 401);
    final res = await http.put(
      Uri.parse('$baseUrl/user/preferences'),
      headers: {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'},
      body: jsonEncode(body),
    );
    final data = _decode(res);
    if (res.statusCode != 200) {
      throw ApiError(message: data['error']?.toString() ?? 'Failed to update preferences', status: res.statusCode);
    }
  }

  // Todos
  Future<List<Map<String, dynamic>>> listTodos() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('jwt');
    if (token == null) throw ApiError(message: 'Not authenticated', status: 401);
    final res = await http.get(Uri.parse('$baseUrl/user/todos'), headers: {'Authorization': 'Bearer $token'});
    final data = _decode(res);
    if (res.statusCode == 200) {
      final List<dynamic> items = data is List ? data : data['todos'] ?? [];
      return items.cast<Map<String, dynamic>>();
    }
    throw ApiError(message: data['error']?.toString() ?? 'Failed to load todos', status: res.statusCode);
  }

  Future<Map<String, dynamic>> createTodo(String title) async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('jwt');
    if (token == null) throw ApiError(message: 'Not authenticated', status: 401);
    final res = await http.post(
      Uri.parse('$baseUrl/user/todos'),
      headers: {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'},
      body: jsonEncode({'title': title}),
    );
    final data = _decode(res);
    if (res.statusCode == 200 || res.statusCode == 201) return data;
    throw ApiError(message: data['error']?.toString() ?? 'Failed to create todo', status: res.statusCode);
  }

  Future<void> completeTodo(String id) async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('jwt');
    if (token == null) throw ApiError(message: 'Not authenticated', status: 401);
    final res = await http.post(
      Uri.parse('$baseUrl/user/todos/$id/complete'),
      headers: {'Authorization': 'Bearer $token'},
    );
    if (res.statusCode != 200) {
      final data = _decode(res);
      throw ApiError(message: data['error']?.toString() ?? 'Failed to complete todo', status: res.statusCode);
    }
  }

  Future<void> deleteTodo(String id) async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('jwt');
    if (token == null) throw ApiError(message: 'Not authenticated', status: 401);
    final res = await http.delete(
      Uri.parse('$baseUrl/user/todos/$id'),
      headers: {'Authorization': 'Bearer $token'},
    );
    if (res.statusCode != 200) {
      final data = _decode(res);
      throw ApiError(message: data['error']?.toString() ?? 'Failed to delete todo', status: res.statusCode);
    }
  }

  // Profile management
  Future<Map<String, dynamic>> getUserProfile() async {
    final prefs = await SharedPreferences.getInstance();
    final userInfo = prefs.getString('user_info');
    if (userInfo != null) {
      return jsonDecode(userInfo) as Map<String, dynamic>;
    }
    return {};
  }

  Future<Map<String, dynamic>> updateProfile({
    String? name,
    String? email,
    String? phoneNumber,
    String? section,
    String? year,
    String? semester,
    String? academicYear,
    String? languagePreference,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('jwt');
    if (token == null) throw ApiError(message: 'Not authenticated', status: 401);

    final body = <String, dynamic>{};
    if (name != null) body['name'] = name;
    if (email != null) body['email'] = email;
    if (phoneNumber != null) body['phoneNumber'] = phoneNumber;
    if (section != null) body['section'] = section;
    if (year != null) body['year'] = year;
    if (semester != null) body['semester'] = semester;
    if (academicYear != null) body['academicYear'] = academicYear;
    if (languagePreference != null) body['languagePreference'] = languagePreference;

    final res = await http.put(
      Uri.parse('$baseUrl/user/profile'),
      headers: {'Authorization': 'Bearer $token', 'Content-Type': 'application/json'},
      body: jsonEncode(body),
    );
    final data = _decode(res);
    if (res.statusCode == 200) {
      // Update stored user info
      await prefs.setString('user_info', jsonEncode(data['user'] ?? {}));
      return data;
    }
    throw ApiError(message: data['error']?.toString() ?? 'Failed to update profile', status: res.statusCode);
  }

  // Timetable management
  Future<Map<String, dynamic>> uploadTimetable(File file) async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('jwt');
    if (token == null) throw ApiError(message: 'Not authenticated', status: 401);

    final request = http.MultipartRequest('POST', Uri.parse('$baseUrl/user/timetable'));
    request.headers['Authorization'] = 'Bearer $token';
    request.files.add(await http.MultipartFile.fromPath('file', file.path));

    final streamedResponse = await request.send();
    final response = await http.Response.fromStream(streamedResponse);
    final data = _decode(response);

    if (response.statusCode == 200) {
      return data;
    }
    throw ApiError(message: data['error']?.toString() ?? 'Failed to upload timetable', status: response.statusCode);
  }

  Future<Map<String, dynamic>> getUserTimetable() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('jwt');
    if (token == null) throw ApiError(message: 'Not authenticated', status: 401);

    final res = await http.get(
      Uri.parse('$baseUrl/user/timetable'),
      headers: {'Authorization': 'Bearer $token'},
    );
    final data = _decode(res);
    if (res.statusCode == 200) {
      return data;
    }
    throw ApiError(message: data['error']?.toString() ?? 'Failed to get timetable', status: res.statusCode);
  }

  Future<void> deleteTimetable(String fileId) async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('jwt');
    if (token == null) throw ApiError(message: 'Not authenticated', status: 401);

    final res = await http.delete(
      Uri.parse('$baseUrl/user/timetable/$fileId'),
      headers: {'Authorization': 'Bearer $token'},
    );
    if (res.statusCode != 200) {
      final data = _decode(res);
      throw ApiError(message: data['error']?.toString() ?? 'Failed to delete timetable', status: res.statusCode);
    }
  }

  // Events (GET open)
  Future<List<Map<String, dynamic>>> getEvents() async {
    final res = await http.get(Uri.parse('$baseUrl/admin/events'));
    final data = _decode(res);
    if (res.statusCode == 200 && data['events'] is List) {
      return (data['events'] as List).cast<Map<String, dynamic>>();
    }
    return [];
  }

  Map<String, dynamic> _decode(http.Response res) {
    try {
      return jsonDecode(res.body) as Map<String, dynamic>;
    } catch (_) {
      return {'error': 'Invalid server response (${res.statusCode})'};
    }
  }
}

class ApiError implements Exception {
  final String message;
  final int status;
  ApiError({required this.message, required this.status});
  @override
  String toString() => 'ApiError($status): $message';
}

