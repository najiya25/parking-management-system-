package com.parking;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ParkingHistoryRepository
        extends JpaRepository<ParkingHistory, Long> {

}