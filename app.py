def main():
    print("Starting the application...")
    # Bug: 'message' is used before it is defined
    print(status_message) 
    status_message = "App is running!"

if __name__ == "__main__":
    main()