import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../core/auth_state.dart';
import '../../core/strings.dart';
import '../../theme/app_theme.dart';

enum _ScanState { idle, success, gpsOutOfRange, qrExpired, alreadyRegistered, generic }

class ScanScreen extends ConsumerStatefulWidget {
  const ScanScreen({super.key});

  @override
  ConsumerState<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends ConsumerState<ScanScreen> {
  bool _busy = false;
  _ScanState _state = _ScanState.idle;
  String _resultMessage = '';

  Future<Position?> _getPosition() async {
    if (!await Geolocator.isLocationServiceEnabled()) return null;
    final perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) {
      final next = await Geolocator.requestPermission();
      if (next == LocationPermission.denied ||
          next == LocationPermission.deniedForever) {
        return null;
      }
    }
    return Geolocator.getCurrentPosition(
      desiredAccuracy: LocationAccuracy.high,
    );
  }

  _ScanState _stateFor(String code) {
    switch (code) {
      case 'GPS_OUT_OF_RANGE':
        return _ScanState.gpsOutOfRange;
      case 'QR_EXPIRED':
      case 'TOKEN_EXPIRED':
        return _ScanState.qrExpired;
      case 'ALREADY_REGISTERED':
        return _ScanState.alreadyRegistered;
      default:
        return _ScanState.generic;
    }
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
      final data = r.data['data'] as Map<String, dynamic>;
      if (!mounted) return;
      final s = AppStrings.of(context);
      setState(() {
        _state = _ScanState.success;
        _resultMessage = s.fill(
          'scan.recordedFor',
          {'status': data['status'] ?? '—'},
        );
      });
    } catch (e) {
      String code = 'ERROR';
      String msg = mounted
          ? AppStrings.of(context).t('scan.tryAgain')
          : 'Try again';
      if (e is DioException) {
        final data = e.response?.data;
        if (data is Map) {
          code = (data['error']?['code'] ?? data['code'] ?? 'ERROR').toString();
          msg = (data['error']?['message'] ?? data['message'] ?? msg).toString();
        }
      }
      if (!mounted) return;
      setState(() {
        _state = _stateFor(code);
        _resultMessage = msg;
      });
    } finally {
      await Future<void>.delayed(const Duration(seconds: 2));
      if (mounted) {
        setState(() {
          _busy = false;
          if (_state == _ScanState.success) _state = _ScanState.idle;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title: Text(AppStrings.of(context).t('scan.title')),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      extendBodyBehindAppBar: true,
      body: Stack(
        children: [
          Positioned.fill(child: MobileScanner(onDetect: _onDetect)),
          Positioned.fill(child: _ScannerFrame(busy: _busy)),
          Align(
            alignment: Alignment.topCenter,
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                child: _ScanInstructions(),
              ),
            ),
          ),
          if (_state != _ScanState.idle)
            Positioned.fill(
              child: _ResultOverlay(
                state: _state,
                message: _resultMessage,
              ),
            ),
        ],
      ),
    );
  }
}

class _ScanInstructions extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.black.withOpacity(0.55),
        borderRadius: SeuRadius.xlR,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.qr_code_scanner, color: SeuColors.gold, size: 20),
          const SizedBox(width: 8),
          Text(
            AppStrings.of(context).t('scan.point'),
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _ScannerFrame extends StatefulWidget {
  const _ScannerFrame({required this.busy});
  final bool busy;

  @override
  State<_ScannerFrame> createState() => _ScannerFrameState();
}

class _ScannerFrameState extends State<_ScannerFrame>
    with TickerProviderStateMixin {
  late final AnimationController _drawIn = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 700),
  )..forward();
  late final AnimationController _beam = AnimationController(
    vsync: this,
    duration: SeuMotion.beam,
  )..repeat();

  @override
  void dispose() {
    _drawIn.dispose();
    _beam.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: Listenable.merge([_drawIn, _beam]),
      builder: (_, __) => CustomPaint(
        painter: _ScannerFramePainter(
          drawIn: Curves.easeOutCubic.transform(_drawIn.value),
          beam: _beam.value,
          dim: widget.busy,
        ),
      ),
    );
  }
}

class _ScannerFramePainter extends CustomPainter {
  _ScannerFramePainter({
    required this.drawIn,
    required this.beam,
    required this.dim,
  });
  final double drawIn;
  final double beam;
  final bool dim;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final cx = w / 2;
    final cy = h / 2;
    final box = 240.0;
    final left = cx - box / 2;
    final top = cy - box / 2;
    final rect = Rect.fromLTWH(left, top, box, box);

    // Dim scrim.
    canvas.drawRect(
      Rect.fromLTWH(0, 0, w, h),
      Paint()..color = Colors.black.withOpacity(dim ? 0.55 : 0.30),
    );
    // Cut-out for the scanner box.
    canvas.drawRRect(
      RRect.fromRectAndRadius(rect, const Radius.circular(20)),
      Paint()..blendMode = BlendMode.clear,
    );

    final corner = 28.0 * drawIn;
    final paint = Paint()
      ..color = SeuColors.gold
      ..strokeWidth = 4
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;

    void cornerLines(Offset o, double sx, double sy) {
      canvas.drawLine(o, o + Offset(corner * sx, 0), paint);
      canvas.drawLine(o, o + Offset(0, corner * sy), paint);
    }

    cornerLines(rect.topLeft, 1, 1);
    cornerLines(rect.topRight, -1, 1);
    cornerLines(rect.bottomLeft, 1, -1);
    cornerLines(rect.bottomRight, -1, -1);

    // Sweep beam (vertical scan line).
    final yPos = top + box * beam;
    final beamPaint = Paint()
      ..shader = LinearGradient(
        colors: [
          SeuColors.gold.withOpacity(0.0),
          SeuColors.gold.withOpacity(0.7),
          SeuColors.gold.withOpacity(0.0),
        ],
      ).createShader(Rect.fromLTWH(left, yPos - 12, box, 24));
    canvas.drawRect(Rect.fromLTWH(left, yPos - 12, box, 24), beamPaint);
  }

  @override
  bool shouldRepaint(covariant _ScannerFramePainter old) =>
      old.drawIn != drawIn || old.beam != beam || old.dim != dim;
}

class _ResultOverlay extends StatelessWidget {
  const _ResultOverlay({required this.state, required this.message});
  final _ScanState state;
  final String message;

  @override
  Widget build(BuildContext context) {
    final s = AppStrings.of(context);
    final (color, icon, title) = switch (state) {
      _ScanState.success => (
          SeuColors.success,
          Icons.check_circle,
          s.t('scan.success'),
        ),
      _ScanState.gpsOutOfRange => (
          SeuColors.danger,
          Icons.location_off,
          s.t('scan.outOfRangeShort'),
        ),
      _ScanState.qrExpired => (
          Colors.orange.shade700,
          Icons.refresh,
          s.t('scan.expiredShort'),
        ),
      _ScanState.alreadyRegistered => (
          SeuColors.info,
          Icons.check_circle_outline,
          s.t('scan.alreadyRegistered'),
        ),
      _ScanState.generic => (
          SeuColors.danger,
          Icons.error_outline,
          s.t('scan.failed'),
        ),
      _ScanState.idle => (SeuColors.gray, Icons.info_outline, '—'),
    };
    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      color: color.withOpacity(0.85),
      alignment: Alignment.center,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 96, color: SeuColors.white)
              .animate()
              .scale(
                begin: const Offset(0.4, 0.4),
                end: const Offset(1, 1),
                duration: const Duration(milliseconds: 300),
                curve: SeuMotion.bounce,
              ),
          const SizedBox(height: 12),
          Text(
            title,
            style: const TextStyle(
              color: SeuColors.white,
              fontSize: 22,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 6),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(color: SeuColors.white, fontSize: 14),
            ),
          ),
        ],
      ),
    );
  }
}


