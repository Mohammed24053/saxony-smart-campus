import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../core/auth_state.dart';

class ScanScreen extends ConsumerStatefulWidget {
  const ScanScreen({super.key});

  @override
  ConsumerState<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends ConsumerState<ScanScreen> {
  bool _busy = false;
  String? _result;

  Future<Position?> _getPosition() async {
    if (!await Geolocator.isLocationServiceEnabled()) return null;
    final perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) {
      final next = await Geolocator.requestPermission();
      if (next == LocationPermission.denied || next == LocationPermission.deniedForever) {
        return null;
      }
    }
    return Geolocator.getCurrentPosition(
      desiredAccuracy: LocationAccuracy.high,
    );
  }

  Future<void> _onDetect(BarcodeCapture cap) async {
    if (_busy || cap.barcodes.isEmpty) return;
    final raw = cap.barcodes.first.rawValue;
    if (raw == null) return;
    setState(() => _busy = true);
    try {
      final pos = await _getPosition();
      final api = ref.read(apiProvider);
      final r = await api.dio.post('/attendance/scan', data: {
        'payload': raw,
        if (pos != null) 'gpsLat': pos.latitude,
        if (pos != null) 'gpsLng': pos.longitude,
      });
      final data = r.data['data'];
      setState(() => _result = '${data['status']}'.toUpperCase());
    } catch (e) {
      setState(() => _result = e.toString());
    } finally {
      await Future<void>.delayed(const Duration(seconds: 2));
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Scan attendance QR')),
      body: Stack(
        children: [
          MobileScanner(onDetect: _onDetect),
          if (_result != null)
            Align(
              alignment: Alignment.bottomCenter,
              child: Container(
                color: Colors.black87,
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                child: Text(
                  _result!,
                  style: const TextStyle(color: Colors.white, fontSize: 20),
                  textAlign: TextAlign.center,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
