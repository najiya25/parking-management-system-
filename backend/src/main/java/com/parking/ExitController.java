package com.parking;

import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
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

    @PostMapping("/exit")
    @Transactional
    public ResponseEntity<?> exitVehicle(
            @RequestBody Map<String, String> request) {

        String vehicleNumber = request.get("vehicleNumber");
        String exitTime = request.get("exitTime");

        if (vehicleNumber == null || vehicleNumber.isBlank()
                || exitTime == null || exitTime.isBlank()) {

            return ResponseEntity.badRequest().body(
                    Map.of("message", "Vehicle number and exit time are required.")
            );
        }

        vehicleNumber = vehicleNumber.trim().toUpperCase();

        // Find the currently parked vehicle
        Vehicle vehicle = vehicleRepository
                .findByVehicleNumber(vehicleNumber)
                .orElse(null);

        if (vehicle == null) {

            return ResponseEntity.badRequest().body(
                    Map.of("message", "Vehicle not found in parking.")
            );
        }

        LocalTime parsedExitTime;
        try {
            parsedExitTime = LocalTime.parse(exitTime.trim(), DateTimeFormatter.ofPattern("HH:mm"));
        } catch (DateTimeParseException e) {
            return ResponseEntity.badRequest().body(
                    Map.of("message", "Exit time must be in HH:mm format.")
            );
        }

        // Get the hourly parking rate
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
                return ResponseEntity.badRequest().body(
                        Map.of("message", "Invalid vehicle type.")
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

        long minutes = java.time.temporal.ChronoUnit.MINUTES.between(
                entryDateTime,
                exitDateTime
        );

        int duration = Math.max(
                1,
                (int) Math.ceil(minutes / 60.0)
        );

        // Calculate parking fee
        BigDecimal fee = BigDecimal.valueOf((long) rate * duration);

        LocalDateTime exitDate = LocalDateTime.now();

        // Save the vehicle's exit details in history
        ParkingHistory history = new ParkingHistory();

        history.setVehicleNumber(vehicle.getVehicleNumber());
        history.setOwnerName(vehicle.getOwnerName());
        history.setVehicleType(vehicle.getVehicleType());
        history.setSlotNumber(vehicle.getSlotNumber());
        history.setEntryTime(vehicle.getEntryTime());
        history.setExitTime(exitTime.trim());
        history.setDuration(duration);
        history.setFee(fee);
        history.setExitDate(exitDate);

        ParkingHistory savedHistory = historyRepository.save(history);

        // Remove vehicle from currently parked vehicles
        vehicleRepository.delete(vehicle);

        return ResponseEntity.ok(
                Map.of(
                        "message", "Vehicle exited successfully!",
                        "vehicle", savedHistory,
                        "duration", duration,
                        "fee", fee
                )
        );
    }
}