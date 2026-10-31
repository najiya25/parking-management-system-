package com.parking;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api")
public class SearchHistoryController {

    private final VehicleRepository vehicleRepository;
    private final ParkingHistoryRepository historyRepository;

    public SearchHistoryController(
            VehicleRepository vehicleRepository,
            ParkingHistoryRepository historyRepository) {

        this.vehicleRepository = vehicleRepository;
        this.historyRepository = historyRepository;
    }

    // Search for a currently parked vehicle
    @GetMapping("/search/{vehicleNumber}")
    public ResponseEntity<?> searchVehicle(
            @PathVariable String vehicleNumber) {

        String number = vehicleNumber.trim().toUpperCase();

        return vehicleRepository.findByVehicleNumber(number)
                .<ResponseEntity<?>>map(vehicle ->
                        ResponseEntity.ok(Map.of("vehicle", vehicle))
                )
                .orElseGet(() ->
                        ResponseEntity.status(404).body(
                                Map.of("message", "Vehicle not found.")
                        )
                );
    }

    // Display all parking history
    @GetMapping("/history")
    public Map<String, Object> getHistory() {

        return Map.of(
                "history",
                historyRepository.findAll(
                        org.springframework.data.domain.Sort
                                .by(org.springframework.data.domain.Sort.Direction.DESC, "id")
                )
        );
    }
}