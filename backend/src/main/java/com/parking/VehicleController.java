package com.parking;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;

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

        return Map.of(
                "vehicles",
                vehicleRepository.findAll()
        );
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

        vehicleNumber = vehicleNumber.trim().toUpperCase();

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