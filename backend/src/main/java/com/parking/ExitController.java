
package com.parking;

import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class ExitController {

    private final VehicleRepository vehicleRepository;
    private final ParkingHistoryRepository historyRepository;

    public ExitController(
            VehicleRepository vehicleRepository,
            ParkingHistoryRepository historyRepository) {

        this.vehicleRepository = vehicleRepository;
        this.historyRepository = historyRepository;
    }

    // STEP 1: Preview parking fee
    @PostMapping("/exit/preview")
    public ResponseEntity<?> previewExit(
            @RequestBody Map<String, String> request) {

        String vehicleNumber = request.get("vehicleNumber");
        String exitTime = request.get("exitTime");

        if (vehicleNumber == null || vehicleNumber.isBlank()
                || exitTime == null || exitTime.isBlank()) {

            return ResponseEntity.badRequest().body(
                    Map.of("message", "Vehicle number and exit time are required.")
            );
        }

        Vehicle vehicle = vehicleRepository
                .findByVehicleNumber(vehicleNumber.trim().toUpperCase())
                .orElse(null);

        if (vehicle == null) {
            return ResponseEntity.badRequest().body(
                    Map.of("message", "Vehicle not found in parking.")
            );
        }

        try {
            ExitDetails details = calculateFee(vehicle, exitTime);

            return ResponseEntity.ok(
                    Map.of(
                            "message", "Parking fee calculated successfully.",
                            "vehicle", vehicle,
                            "duration", details.duration,
                            "fee", details.fee
                    )
            );

        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(
                    Map.of("message", e.getMessage())
            );
        }
    }

    // STEP 2: Save Pending or Failed payment attempt
    @PostMapping("/exit/attempt")
    @Transactional
    public ResponseEntity<?> savePaymentAttempt(
            @RequestBody Map<String, String> request) {

        String vehicleNumber = request.get("vehicleNumber");
        String exitTime = request.get("exitTime");
        String paymentMethod = request.get("paymentMethod");
        String paymentStatus = request.get("paymentStatus");

        if (vehicleNumber == null || vehicleNumber.isBlank()
                || exitTime == null || exitTime.isBlank()
                || paymentMethod == null || paymentMethod.isBlank()
                || paymentStatus == null || paymentStatus.isBlank()) {

            return ResponseEntity.badRequest().body(
                    Map.of("message", "All payment details are required.")
            );
        }

        vehicleNumber = vehicleNumber.trim().toUpperCase();
        paymentMethod = paymentMethod.trim().toUpperCase();
        paymentStatus = paymentStatus.trim();

        if (!paymentMethod.equals("UPI")
                && !paymentMethod.equals("CARD")
                && !paymentMethod.equals("CASH")) {

            return ResponseEntity.badRequest().body(
                    Map.of("message", "Choose UPI, Card or Cash.")
            );
        }

        if (!paymentStatus.equalsIgnoreCase("Pending")
                && !paymentStatus.equalsIgnoreCase("Failed")) {

            return ResponseEntity.badRequest().body(
                    Map.of("message", "Status must be Pending or Failed.")
            );
        }

        Vehicle vehicle = vehicleRepository
                .findByVehicleNumber(vehicleNumber)
                .orElse(null);

        if (vehicle == null) {
            return ResponseEntity.badRequest().body(
                    Map.of("message", "Vehicle not found in parking.")
            );
        }

        try {
            ExitDetails details = calculateFee(vehicle, exitTime);

            ParkingHistory history = new ParkingHistory();

            history.setVehicleNumber(vehicle.getVehicleNumber());
            history.setOwnerName(vehicle.getOwnerName());
            history.setVehicleType(vehicle.getVehicleType());
            history.setSlotNumber(vehicle.getSlotNumber());

            history.setEntryTime(vehicle.getEntryTime());
            history.setEntryDate(vehicle.getEntryDate());

            history.setExitTime(null);
            history.setExitDate(null);
            history.setDuration(null);

            history.setFee(details.fee);
            history.setPaymentMethod(paymentMethod);
            history.setPaymentStatus(paymentStatus);
            history.setPaymentDate(LocalDateTime.now());

            ParkingHistory savedHistory = historyRepository.save(history);

            return ResponseEntity.ok(
                    Map.of(
                            "message", "Payment attempt saved. Vehicle is still parked.",
                            "vehicle", savedHistory,
                            "paymentStatus", paymentStatus
                    )
            );

        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(
                    Map.of("message", e.getMessage())
            );
        }
    }

    // STEP 3: Confirm payment and complete vehicle exit
  
@PostMapping("/exit/confirm")
@Transactional
public ResponseEntity<?> confirmExit(
        @RequestBody Map<String, String> request) {

    String vehicleNumber = request.get("vehicleNumber");
    String exitTime = request.get("exitTime");
    String paymentMethod = request.get("paymentMethod");
    String historyId = request.get("historyId");

    if (vehicleNumber == null || vehicleNumber.isBlank()
            || exitTime == null || exitTime.isBlank()
            || paymentMethod == null || paymentMethod.isBlank()) {

        return ResponseEntity.badRequest().body(
                Map.of("message", "Vehicle number, exit time and payment method are required.")
        );
    }

    vehicleNumber = vehicleNumber.trim().toUpperCase();
    paymentMethod = paymentMethod.trim().toUpperCase();

    if (!paymentMethod.equals("UPI")
            && !paymentMethod.equals("CARD")
            && !paymentMethod.equals("CASH")) {

        return ResponseEntity.badRequest().body(
                Map.of("message", "Choose UPI, Card or Cash.")
        );
    }

    Vehicle vehicle = vehicleRepository
            .findByVehicleNumber(vehicleNumber)
            .orElse(null);

    if (vehicle == null) {
        return ResponseEntity.badRequest().body(
                Map.of("message", "Vehicle not found in parking.")
        );
    }

    try {
        ExitDetails details = calculateFee(vehicle, exitTime);

        ParkingHistory history;

        // Update an existing Pending/Failed record if its ID is supplied
        if (historyId != null && !historyId.isBlank()) {

            Long id = Long.parseLong(historyId);

            history = historyRepository.findById(id).orElse(null);

            if (history == null
                    || !history.getVehicleNumber().equalsIgnoreCase(vehicleNumber)) {

                return ResponseEntity.badRequest().body(
                        Map.of("message", "Payment history record not found.")
                );
            }

            if ("Paid".equalsIgnoreCase(history.getPaymentStatus())
                    || "Confirmed".equalsIgnoreCase(history.getPaymentStatus())) {

                return ResponseEntity.badRequest().body(
                        Map.of("message", "This payment is already confirmed.")
                );
            }

        } else {
            history = new ParkingHistory();

            history.setVehicleNumber(vehicle.getVehicleNumber());
            history.setOwnerName(vehicle.getOwnerName());
            history.setVehicleType(vehicle.getVehicleType());
            history.setSlotNumber(vehicle.getSlotNumber());
            history.setEntryTime(vehicle.getEntryTime());
            history.setEntryDate(vehicle.getEntryDate());
        }

        history.setExitTime(exitTime.trim());
        history.setExitDate(details.exitDateTime);
        history.setDuration(details.duration);
        history.setFee(details.fee);
        history.setPaymentMethod(paymentMethod);
        history.setPaymentStatus("Paid");
        history.setPaymentDate(LocalDateTime.now());

        ParkingHistory savedHistory = historyRepository.save(history);

        // Remove vehicle only after payment confirmation
        vehicleRepository.delete(vehicle);

        return ResponseEntity.ok(
                Map.of(
                        "message", "Payment confirmed and vehicle exited successfully!",
                        "vehicle", savedHistory,
                        "duration", details.duration,
                        "fee", details.fee,
                        "paymentMethod", paymentMethod,
                        "paymentStatus", "Paid"
                )
        );

    } catch (IllegalArgumentException e) {
        return ResponseEntity.badRequest().body(
                Map.of("message", e.getMessage())
        );
    }
}


    // Calculate parking duration and fee
    private ExitDetails calculateFee(Vehicle vehicle, String exitTime) {

        LocalTime parsedExitTime;

        try {
            parsedExitTime = LocalTime.parse(
                    exitTime.trim(),
                    DateTimeFormatter.ofPattern("HH:mm")
            );
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException(
                    "Please enter a valid exit time."
            );
        }

        int rate;

        switch (vehicle.getVehicleType().trim().toLowerCase()) {
            case "car":
                rate = 20;
                break;

            case "bike":
                rate = 10;
                break;

            case "auto":
                rate = 15;
                break;

            case "van":
                rate = 25;
                break;

            default:
                throw new IllegalArgumentException(
                        "Invalid vehicle type."
                );
        }

        LocalDateTime entryDateTime = vehicle.getEntryDate();

        LocalDateTime exitDateTime = LocalDateTime.of(
                entryDateTime.toLocalDate(),
                parsedExitTime
        );

        if (exitDateTime.isBefore(entryDateTime)) {
            exitDateTime = exitDateTime.plusDays(1);
        }

        long minutes = ChronoUnit.MINUTES.between(
                entryDateTime,
                exitDateTime
        );

        int duration = Math.max(
                1,
                (int) Math.ceil(minutes / 60.0)
        );

        BigDecimal fee = BigDecimal.valueOf(
                (long) rate * duration
        );

        return new ExitDetails(duration, fee, exitDateTime);
    }

    private static class ExitDetails {

        private final int duration;
        private final BigDecimal fee;
        private final LocalDateTime exitDateTime;

        private ExitDetails(
                int duration,
                BigDecimal fee,
                LocalDateTime exitDateTime) {

            this.duration = duration;
            this.fee = fee;
            this.exitDateTime = exitDateTime;
        }
    }
}
