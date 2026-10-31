
package com.parking;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api")
public class VehicleController {

    private final VehicleRepository vehicleRepository;

    public VehicleController(VehicleRepository vehicleRepository) {
        this.vehicleRepository = vehicleRepository;
    }

    // Display all currently parked vehicles
    @GetMapping("/vehicles")
    public Map<String, Object> getVehicles() {
        return Map.of("vehicles", vehicleRepository.findAll());
    }

    // Register a new vehicle
    @PostMapping("/entry")
    public ResponseEntity<?> addVehicle(
            @RequestBody Map<String, String> request) {

        String vehicleNumber = request.get("vehicleNumber");
        String ownerName = request.get("ownerName");
        String vehicleType = request.get("vehicleType");
        String entryTime = request.get("entryTime");

        if (vehicleNumber == null || vehicleNumber.isBlank()
                || ownerName == null || ownerName.isBlank()
                || vehicleType == null || vehicleType.isBlank()
                || entryTime == null || entryTime.isBlank()) {

            return ResponseEntity.badRequest().body(
                    Map.of("message", "Please fill in all vehicle details.")
            );
        }

        // Convert to uppercase and remove spaces and hyphens
        String number = vehicleNumber
                .trim()
                .toUpperCase()
                .replaceAll("[\\s-]", "");

        // Validate standard Indian vehicle registration format
        Pattern pattern = Pattern.compile(
                "^([A-Z]{2})([0-9]{1,2})([A-Z]{1,3})([0-9]{1,4})$"
        );

        Matcher matcher = pattern.matcher(number);

        if (!matcher.matches()) {
            return ResponseEntity.badRequest().body(
                    Map.of(
                            "message",
                            "Invalid vehicle number. Enter a valid Indian number, for example KL-01-AB-1234."
                    )
            );
        }

        // Store every number in the same format
        vehicleNumber = matcher.group(1) + "-"
                + matcher.group(2) + "-"
                + matcher.group(3) + "-"
                + matcher.group(4);

        // Check whether vehicle is already parked
        if (vehicleRepository.existsByVehicleNumber(vehicleNumber)) {
            return ResponseEntity.badRequest().body(
                    Map.of("message", "This vehicle is already parked.")
            );
        }

        // Find the first available parking slot
        Set<String> occupiedSlots = new HashSet<>();

        for (Vehicle vehicle : vehicleRepository.findAll()) {
            occupiedSlots.add(vehicle.getSlotNumber());
        }

        String availableSlot = null;

        for (int i = 1; i <= 8; i++) {
            String slot = String.format("P%02d", i);

            if (!occupiedSlots.contains(slot)) {
                availableSlot = slot;
                break;
            }
        }

        if (availableSlot == null) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(
                    Map.of("message", "Parking is full. No slots available.")
            );
        }

        // Save vehicle details
        Vehicle vehicle = new Vehicle();

        vehicle.setVehicleNumber(vehicleNumber);
        vehicle.setOwnerName(ownerName.trim());
        vehicle.setVehicleType(vehicleType);
        vehicle.setSlotNumber(availableSlot);
        vehicle.setEntryTime(entryTime);
        vehicle.setEntryDate(LocalDateTime.now());

        Vehicle savedVehicle = vehicleRepository.save(vehicle);

        return ResponseEntity.status(HttpStatus.CREATED).body(
                Map.of(
                        "message", "Vehicle entered successfully!",
                        "vehicle", savedVehicle
                )
        );
    }
}
